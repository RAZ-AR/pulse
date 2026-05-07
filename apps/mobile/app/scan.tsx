import { useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter, Stack } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import { trpc } from "../src/lib/trpc"
import { uploadReceiptImage } from "../src/lib/storage"
import { colors, fonts, useTheme } from "../src/lib/theme"

type Phase =
  | { kind: "camera" }
  | { kind: "uploading" }
  | { kind: "scanning"; imageUrl: string }
  | { kind: "confirm"; imageUrl: string; ocr: OcrFields; receiptHash: string | null; confidence: number }
  | { kind: "submitting" }
  | { kind: "done"; pointsEarned: number }

type OcrFields = {
  vendor: string
  amount: string
  currency: string
  date: string
  receiptNumber: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ScanScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()
  const me = trpc.user.me.useQuery()
  const userId = me.data?.id

  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "camera" })

  const scanMutation = trpc.transaction.scanReceipt.useMutation()
  const confirmMutation = trpc.transaction.confirmReceipt.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
    },
  })

  async function handleCapture() {
    if (!cameraRef.current || !userId) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false })
      if (!photo?.uri) throw new Error("No photo URI")

      setPhase({ kind: "uploading" })
      const imageUrl = await uploadReceiptImage(photo.uri, userId)

      setPhase({ kind: "scanning", imageUrl })
      const result = await scanMutation.mutateAsync({ imageUrl })

      const d = result.ocrData
      setPhase({
        kind: "confirm",
        imageUrl,
        receiptHash: result.receiptHash,
        confidence: result.confidence,
        ocr: {
          vendor: d.vendor ?? "",
          amount: d.total !== null ? String(d.total) : "",
          currency: d.currency ?? "RSD",
          date: d.date ?? today(),
          receiptNumber: d.receiptNumber ?? "",
        },
      })
    } catch (e) {
      Alert.alert(t("scanFailed", "Scan failed"), e instanceof Error ? e.message : String(e))
      setPhase({ kind: "camera" })
    }
  }

  async function handleConfirm() {
    if (phase.kind !== "confirm") return
    const amount = parseFloat(phase.ocr.amount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t("invalidAmount", "Enter a valid amount"))
      return
    }
    if (!phase.ocr.vendor.trim()) {
      Alert.alert(t("invalidVendor", "Enter a vendor name"))
      return
    }
    setPhase({ kind: "submitting" })
    try {
      const res = await confirmMutation.mutateAsync({
        imageUrl: phase.imageUrl,
        ...(phase.receiptHash ? { receiptHash: phase.receiptHash } : {}),
        vendor: phase.ocr.vendor.trim(),
        amount,
        currency: phase.ocr.currency.trim().toUpperCase().slice(0, 3) || "RSD",
        date: phase.ocr.date,
        ...(phase.ocr.receiptNumber.trim() ? { receiptNumber: phase.ocr.receiptNumber.trim() } : {}),
        ocrConfidence: phase.confidence,
      })
      setPhase({ kind: "done", pointsEarned: res.pointsEarned })
    } catch (e) {
      Alert.alert(t("submitFailed", "Submit failed"), e instanceof Error ? e.message : String(e))
      // keep ocr state so user can retry
      setPhase({
        kind: "confirm",
        imageUrl: phase.imageUrl,
        receiptHash: phase.receiptHash,
        confidence: phase.confidence,
        ocr: phase.ocr,
      })
    }
  }

  // ── Render by phase ───────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("scanReceipt", "Scan receipt"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {phase.kind === "camera" ? (
          <CameraPhase
            permission={permission}
            requestPermission={requestPermission}
            cameraRef={cameraRef}
            onCapture={handleCapture}
            theme={theme}
          />
        ) : phase.kind === "uploading" || phase.kind === "scanning" ? (
          <LoadingPhase
            label={phase.kind === "uploading" ? t("uploading", "Uploading…") : t("readingReceipt", "Reading receipt…")}
            theme={theme}
          />
        ) : phase.kind === "confirm" ? (
          <ConfirmPhase
            ocr={phase.ocr}
            onChange={(ocr) => setPhase({ ...phase, ocr })}
            onSubmit={handleConfirm}
            confidence={phase.confidence}
            theme={theme}
          />
        ) : phase.kind === "submitting" ? (
          <LoadingPhase label={t("submitting", "Submitting…")} theme={theme} />
        ) : (
          <DonePhase
            pointsEarned={phase.pointsEarned}
            onClose={() => router.back()}
            theme={theme}
          />
        )}
      </View>
    </>
  )
}

// ── Phase components ─────────────────────────────────────────

function CameraPhase({
  permission, requestPermission, cameraRef, onCapture, theme,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: ReturnType<typeof useCameraPermissions>[1]
  cameraRef: { current: CameraView | null }
  onCapture: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")

  if (!permission) {
    return <View style={s.center}><ActivityIndicator color={theme.text} /></View>
  }
  if (!permission.granted) {
    return (
      <View style={[s.center, { padding: 24 }]}>
        <Text style={[s.dialogTitle, { color: theme.text }]}>{t("cameraNeeded", "Camera access needed")}</Text>
        <Text style={[s.dialogText, { color: theme.textSecondary }]}>
          {t("cameraNeededDesc", "PULSE needs your camera to scan receipts.")}
        </Text>
        <Pressable onPress={requestPermission} style={[s.btn, { backgroundColor: theme.text }]}>
          <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("grantAccess", "Grant access")}</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <View style={s.cameraWrap}>
      <CameraView ref={cameraRef} style={s.camera} facing="back" />
      <View style={s.cameraOverlay}>
        <View style={s.frame} />
        <Text style={s.frameHint}>{t("framingHint", "Position the receipt in the frame")}</Text>
      </View>
      <View style={s.shutterRow}>
        <Pressable onPress={onCapture} style={s.shutter}>
          <View style={s.shutterInner} />
        </Pressable>
      </View>
    </View>
  )
}

function LoadingPhase({ label, theme }: { label: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.skySolid} />
      <Text style={[s.loadingLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  )
}

function ConfirmPhase({
  ocr, onChange, onSubmit, confidence, theme,
}: {
  ocr: OcrFields
  onChange: (next: OcrFields) => void
  onSubmit: () => void
  confidence: number
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")
  return (
    <ScrollView contentContainerStyle={s.confirmContent}>
      <Text style={[s.confirmTitle, { color: theme.text }]}>
        {t("confirmReceipt", "Confirm receipt details")}
      </Text>
      {confidence < 0.85 ? (
        <Text style={[s.lowConf, { color: colors.pink }]}>
          {t("lowConfidence", "Low OCR confidence - please double-check fields below")}
        </Text>
      ) : null}

      <Field label={t("vendor", "Vendor")} value={ocr.vendor} onChangeText={(v) => onChange({ ...ocr, vendor: v })} theme={theme} />
      <Field label={t("amount", "Amount")} value={ocr.amount} onChangeText={(v) => onChange({ ...ocr, amount: v })} keyboardType="decimal-pad" theme={theme} />
      <Field label={t("currency", "Currency")} value={ocr.currency} onChangeText={(v) => onChange({ ...ocr, currency: v.toUpperCase() })} theme={theme} />
      <Field label={t("date", "Date (YYYY-MM-DD)")} value={ocr.date} onChangeText={(v) => onChange({ ...ocr, date: v })} theme={theme} />
      <Field label={t("receiptNumber", "Receipt # (optional)")} value={ocr.receiptNumber} onChangeText={(v) => onChange({ ...ocr, receiptNumber: v })} theme={theme} />

      <Pressable onPress={onSubmit} style={[s.btn, { backgroundColor: theme.text, marginTop: 12 }]}>
        <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("confirmAndEarn", "Confirm and earn points")}</Text>
      </Pressable>
    </ScrollView>
  )
}

function DonePhase({
  pointsEarned, onClose, theme,
}: { pointsEarned: number; onClose: () => void; theme: ReturnType<typeof useTheme> }) {
  const { t } = useTranslation("common")
  const isManualReview = pointsEarned === 0
  return (
    <View style={[s.center, { padding: 24 }]}>
      <Text style={s.doneIcon}>{isManualReview ? "🕓" : "✓"}</Text>
      <Text style={[s.doneTitle, { color: theme.text }]}>
        {isManualReview ? t("pendingReview", "Pending review") : t("pointsAwarded", "Points awarded!")}
      </Text>
      {isManualReview ? (
        <Text style={[s.doneSub, { color: theme.textSecondary }]}>
          {t("largeReceiptReview", "Large receipts go through manual review. You'll see the points soon.")}
        </Text>
      ) : (
        <Text style={[s.donePoints, { color: colors.mint }]}>+{pointsEarned} pts</Text>
      )}
      <Pressable onPress={onClose} style={[s.btn, { backgroundColor: theme.text, marginTop: 24 }]}>
        <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("done", "Done")}</Text>
      </Pressable>
    </View>
  )
}

function Field({
  label, value, onChangeText, keyboardType, theme,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  keyboardType?: "default" | "decimal-pad"
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        style={[s.input, { borderColor: theme.border, color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
  frame: { width: "100%", aspectRatio: 0.6, borderWidth: 2, borderColor: "#FFF", borderRadius: 30, opacity: 0.86 },
  frameHint: { color: "#FFF", marginTop: 12, fontSize: 13, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  shutterRow: { position: "absolute", bottom: 32, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.28)", borderWidth: 3, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FFF" },
  loadingLabel: { fontSize: 13, marginTop: 14 },
  confirmContent: { padding: 18, paddingBottom: 40 },
  confirmTitle: { fontSize: 31, lineHeight: 34, fontFamily: fonts.displayHeavy, marginBottom: 6 },
  lowConf: { fontSize: 12, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "700", marginBottom: 6, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 18, padding: 13, fontSize: 15, backgroundColor: "#FFFFFF" },
  btn: { padding: 14, borderRadius: 99, alignItems: "center" },
  dialogTitle: { fontSize: 26, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  dialogText: { fontSize: 13, marginBottom: 20, textAlign: "center", lineHeight: 18 },
  doneIcon: { fontSize: 64, marginBottom: 12 },
  doneTitle: { fontSize: 31, lineHeight: 34, fontWeight: "800" },
  doneSub: { fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 18 },
  donePoints: { fontSize: 32, fontWeight: "800", marginTop: 12 },
})
