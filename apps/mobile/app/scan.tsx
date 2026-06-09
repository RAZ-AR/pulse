import { useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter, Stack } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import { trpc } from "../src/lib/trpc"
import { uploadReceiptImage } from "../src/lib/storage"
import { colors, neonColors, fonts, useTheme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { IS_TELEGRAM, getTgWebApp } from "../src/lib/telegram"

type Mode = "qr" | "photo"

type Phase =
  | { kind: "camera"; mode: Mode }
  | { kind: "uploading" }
  | { kind: "scanning"; imageUrl: string }
  | { kind: "confirm"; imageUrl: string; ocr: OcrFields; receiptHash: string | null; confidence: number }
  | { kind: "submitting" }
  | { kind: "error"; message: string; mode: Mode; alreadyScanned?: boolean }
  | {
      kind: "done"
      pointsEarned: number
      streakBonus?: number | undefined
      vendorName?: string | undefined
      totalRsd?: number | undefined
      offerTitle?: string | undefined
      needsManualReview?: boolean | undefined
      date?: string | undefined
    }

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
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const router = useRouter()
  const utils = trpc.useUtils()
  const me = trpc.user.me.useQuery()
  const userId = me.data?.id

  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "camera", mode: "qr" })

  const scanMutation = trpc.transaction.scanReceipt.useMutation()
  const scanQrMutation = trpc.transaction.scanQrReceipt.useMutation()
  const redeemOfferMutation = trpc.offer.redeem.useMutation()
  const confirmMutation = trpc.transaction.confirmReceipt.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })

  // ── Show error (works in both native and Telegram WebView) ──
  function showError(title: string, message: string, mode: Mode = "qr") {
    const alreadyScanned =
      message.toLowerCase().includes("already been scanned") ||
      message.toLowerCase().includes("already scanned") ||
      message.includes("CONFLICT")
    setPhase({ kind: "error", message: alreadyScanned ? "" : `${title}\n\n${message}`, mode, alreadyScanned })
  }

  // ── Telegram native QR scanner ───────────────────────────
  function openTelegramQrScanner() {
    const tg = getTgWebApp()
    if (!tg?.showScanQrPopup) {
      showError("Ошибка", "QR scanning not available in this Telegram version")
      return
    }
    // Reset any stale scan state
    setPhase({ kind: "camera", mode: "qr" })
    setTimeout(() => {
      tg.showScanQrPopup({ text: "Point at the QR code on the receipt" }, (data: string) => {
        tg.closeScanQrPopup?.()
        void handleQrScanned(data)
        return true
      })
    }, 50)
  }

  // ── QR scan — роутер по типу QR ──────────────────────────

  async function handleQrScanned(data: string) {
    if (phase.kind === "submitting" || phase.kind === "done") return
    setPhase({ kind: "submitting" })

    try {
      // 1. ayoo offer QR: ayoo://offer/<token>
      const offerMatch = data.match(/^ayoo:\/\/offer\/(.+)$/)
      if (offerMatch) {
        const token = offerMatch[1]!
        const res = await redeemOfferMutation.mutateAsync({ token })
        utils.user.me.invalidate()
        setPhase({ kind: "done", pointsEarned: res.pointsEarned, offerTitle: res.offerTitle })
        return
      }

      // 2. Serbian fiscal QR: suf.purs.gov.rs/v/?vl=...
      if (data.includes("suf.purs.gov.rs")) {
        const res = await scanQrMutation.mutateAsync({ qrUrl: data })
        utils.user.me.invalidate()
        setPhase({
          kind: "done",
          pointsEarned: res.pointsEarned,
          streakBonus: res.streakBonus ?? undefined,
          vendorName: res.vendorName ?? undefined,
          totalRsd: res.totalRsd,
          needsManualReview: res.needsManualReview,
          date: res.date ?? undefined,
        })
        return
      }

      // 3. Unknown QR — show what was scanned so user can report
      showError(
        t("unknownQr", "Unknown QR code"),
        t("unknownQrDesc", "This QR is not a Serbian fiscal receipt.\n\nScanned: ") + data.slice(0, 80)
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      showError(t("scanFailed", "Scan failed"), msg)
    }
  }

  // ── Photo scan (AI OCR) ───────────────────────────────────

  async function handleCapture() {
    if (phase.kind !== "camera" || !cameraRef.current || !userId) return
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
      showError(t("scanFailed", "Scan failed"), e instanceof Error ? e.message : String(e), "photo")
    }
  }

  async function handleConfirm() {
    if (phase.kind !== "confirm") return
    const amount = parseFloat(phase.ocr.amount)
    if (isNaN(amount) || amount <= 0) {
      showError(t("invalidAmount", "Enter a valid amount"), "")
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
      showError(t("submitFailed", "Submit failed"), e instanceof Error ? e.message : String(e))
    }
  }

  const currentMode = phase.kind === "camera" ? phase.mode : "qr"

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
          <>
            {/* Mode toggle */}
            <View style={[s.modeRow, { borderBottomColor: theme.border }]}>
              <Pressable
                style={[s.modeBtn, phase.mode === "qr" && s.modeBtnActive]}
                onPress={() => setPhase({ kind: "camera", mode: "qr" })}
              >
                <Text style={[s.modeBtnText, { color: phase.mode === "qr" ? colors.skySolid : theme.textSecondary }]}>
                  {t("qrCode", "QR Code")}
                </Text>
              </Pressable>
              <Pressable
                style={[s.modeBtn, phase.mode === "photo" && s.modeBtnActive]}
                onPress={() => setPhase({ kind: "camera", mode: "photo" })}
              >
                <Text style={[s.modeBtnText, { color: phase.mode === "photo" ? colors.skySolid : theme.textSecondary }]}>
                  {t("photo", "Photo")}
                </Text>
              </Pressable>
            </View>

            {IS_TELEGRAM && phase.mode === "qr" ? (
              <TelegramQrPhase onPress={openTelegramQrScanner} theme={theme} t={t} />
            ) : (
              <CameraPhase
                mode={phase.mode}
                permission={permission}
                requestPermission={requestPermission}
                cameraRef={cameraRef}
                onCapture={handleCapture}
                onQrScanned={handleQrScanned}
                theme={theme}
              />
            )}
          </>
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
        ) : phase.kind === "error" ? (
          <ErrorPhase
            message={phase.message}
            alreadyScanned={phase.alreadyScanned}
            onRetry={() => setPhase({ kind: "camera", mode: phase.mode })}
            theme={theme}
          />
        ) : (
          <DonePhase
            pointsEarned={phase.pointsEarned}
            streakBonus={phase.streakBonus}
            vendorName={phase.vendorName}
            totalRsd={phase.totalRsd}
            offerTitle={phase.offerTitle}
            needsManualReview={phase.needsManualReview}
            date={phase.date}
            onClose={() => router.back()}
            theme={theme}
            isRainbow={isRainbow}
          />
        )}
      </View>
    </>
  )
}

// ── TelegramQrPhase — uses Telegram native scanner ───────────

function TelegramQrPhase({
  onPress, theme, t,
}: {
  onPress: () => void
  theme: ReturnType<typeof useTheme>
  t: (key: string, fallback: string) => string
}) {
  return (
    <View style={[s.center, { padding: 32, gap: 20 }]}>
      <Text style={{ fontSize: 72 }}>📷</Text>
      <Text style={[s.dialogTitle, { color: theme.text, fontSize: 22 }]}>
        {t("scanQrCode", "Scan QR code")}
      </Text>
      <Text style={[s.dialogText, { color: theme.textSecondary }]}>
        {t("tapToScanQr", "Tap the button below to open the camera and scan the QR code from your receipt.")}
      </Text>
      <Pressable onPress={onPress} style={[s.btn, { backgroundColor: colors.skySolid, paddingHorizontal: 32 }]}>
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
          {t("openCamera", "Open camera")}
        </Text>
      </Pressable>
    </View>
  )
}

// ── CameraPhase ───────────────────────────────────────────────

function CameraPhase({
  mode, permission, requestPermission, cameraRef, onCapture, onQrScanned, theme,
}: {
  mode: Mode
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: ReturnType<typeof useCameraPermissions>[1]
  cameraRef: { current: CameraView | null }
  onCapture: () => void
  onQrScanned: (url: string) => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")
  const [qrScanned, setQrScanned] = useState(false)

  if (!permission) return <View style={s.center}><ActivityIndicator color={theme.text} /></View>

  if (!permission.granted) {
    return (
      <View style={[s.center, { padding: 24 }]}>
        <Text style={[s.dialogTitle, { color: theme.text }]}>{t("cameraNeeded", "Camera access needed")}</Text>
        <Text style={[s.dialogText, { color: theme.textSecondary }]}>
          {t("cameraNeededDesc", "ayoo needs your camera to scan receipts.")}
        </Text>
        <Pressable onPress={requestPermission} style={[s.btn, { backgroundColor: "#F9FBFF" }]}>
          <Text style={{ color: theme.text, fontWeight: "700" }}>{t("grantAccess", "Grant access")}</Text>
        </Pressable>
      </View>
    )
  }

  const isQr = mode === "qr"

  return (
    <View style={s.cameraWrap}>
      <CameraView
        ref={cameraRef}
        style={s.camera}
        facing="back"
        barcodeScannerSettings={isQr ? { barcodeTypes: ["qr"] } : undefined}
        onBarcodeScanned={isQr && !qrScanned ? (e) => {
          setQrScanned(true)
          onQrScanned(e.data)
        } : undefined}
      />
      <View style={s.cameraOverlay}>
        <View style={[s.frame, isQr && s.frameQr]} />
        <Text style={s.frameHint}>
          {isQr
            ? t("frameQrHint", "Point at the QR code on the receipt")
            : t("framingHint", "Position the receipt in the frame")}
        </Text>
      </View>
      {!isQr && (
        <View style={s.shutterRow}>
          <Pressable onPress={onCapture} style={s.shutter}>
            <View style={s.shutterInner} />
          </Pressable>
        </View>
      )}
    </View>
  )
}

// ── Other phases ──────────────────────────────────────────────

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
          {t("lowConfidence", "Low OCR confidence — please double-check fields below")}
        </Text>
      ) : null}
      <Field label={t("vendor", "Vendor")} value={ocr.vendor} onChangeText={(v) => onChange({ ...ocr, vendor: v })} theme={theme} />
      <Field label={t("amount", "Amount")} value={ocr.amount} onChangeText={(v) => onChange({ ...ocr, amount: v })} keyboardType="decimal-pad" theme={theme} />
      <Field label={t("currency", "Currency")} value={ocr.currency} onChangeText={(v) => onChange({ ...ocr, currency: v.toUpperCase() })} theme={theme} />
      <Field label={t("date", "Date (YYYY-MM-DD)")} value={ocr.date} onChangeText={(v) => onChange({ ...ocr, date: v })} theme={theme} />
      <Field label={t("receiptNumber", "Receipt # (optional)")} value={ocr.receiptNumber} onChangeText={(v) => onChange({ ...ocr, receiptNumber: v })} theme={theme} />
      <Pressable onPress={onSubmit} style={[s.btn, { backgroundColor: "#F9FBFF", marginTop: 12 }]}>
        <Text style={{ color: theme.text, fontWeight: "700" }}>{t("confirmAndEarn", "Confirm and earn points")}</Text>
      </Pressable>
    </ScrollView>
  )
}

// ── ErrorPhase ────────────────────────────────────────────────

function ErrorPhase({
  message, alreadyScanned, onRetry, theme,
}: {
  message: string
  alreadyScanned?: boolean | undefined
  onRetry: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")

  if (alreadyScanned) {
    return (
      <View style={[s.center, { padding: 28 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🧾</Text>
        <Text style={[s.doneTitle, { color: theme.text, textAlign: "center", marginBottom: 12 }]}>
          {t("receiptAlreadyScanned", "Receipt already used")}
        </Text>
        <Text style={[{ color: theme.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 }]}>
          {t("receiptAlreadyScannedDesc", "This receipt has already been scanned and points were awarded. Each receipt can only be used once.")}
        </Text>
        <Pressable
          onPress={onRetry}
          style={[s.btn, { backgroundColor: colors.skySolid, paddingHorizontal: 40 }]}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
            {t("scanAnother", "Scan another receipt")}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[s.center, { padding: 28 }]}>
      <Text style={{ fontSize: 52, marginBottom: 12 }}>⚠️</Text>
      <Text style={[s.doneTitle, { color: theme.text, marginBottom: 12 }]}>
        {t("scanFailed", "Scan failed")}
      </Text>
      <View style={[s.receiptCard, { backgroundColor: theme.surface, borderColor: "#FFD0D0" }]}>
        <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }}>{message}</Text>
      </View>
      <Pressable
        onPress={onRetry}
        style={[s.btn, { backgroundColor: colors.skySolid, marginTop: 24, paddingHorizontal: 40 }]}
      >
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
          {t("tryAgain", "Try again")}
        </Text>
      </Pressable>
    </View>
  )
}

function DonePhase({
  pointsEarned, streakBonus, vendorName, totalRsd, offerTitle,
  needsManualReview, date, onClose, theme, isRainbow,
}: {
  pointsEarned: number
  streakBonus?: number | undefined
  vendorName?: string | undefined
  totalRsd?: number | undefined
  offerTitle?: string | undefined
  needsManualReview?: boolean | undefined
  date?: string | undefined
  onClose: () => void
  theme: ReturnType<typeof useTheme>
  isRainbow?: boolean
}) {
  const { t } = useTranslation("common")
  const isPending = needsManualReview || pointsEarned === 0
  const accentColor = isRainbow ? neonColors.green : colors.mint
  const formattedDate = date
    ? new Date(date).toLocaleDateString("sr-RS", { day: "2-digit", month: "short", year: "numeric" })
    : null

  return (
    <View style={[s.center, { padding: 24 }]}>
      {/* Status icon */}
      <View style={[s.doneIconWrap, { backgroundColor: isPending ? "#FFF8E7" : "#E8FFF4" }]}>
        <Text style={s.doneIcon}>{isPending ? "🕓" : "✅"}</Text>
      </View>

      <Text style={[s.doneTitle, { color: theme.text, marginTop: 16 }]}>
        {isPending ? t("pendingReview", "Pending review") : t("pointsAwarded", "Points awarded!")}
      </Text>

      {/* Receipt card */}
      {(vendorName || offerTitle || totalRsd) ? (
        <View style={[s.receiptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {offerTitle ? (
            <Text style={[s.receiptVendor, { color: theme.text }]}>{offerTitle}</Text>
          ) : vendorName ? (
            <Text style={[s.receiptVendor, { color: theme.text }]}>{vendorName}</Text>
          ) : null}

          {totalRsd ? (
            <Text style={[s.receiptAmount, { color: theme.textSecondary }]}>
              {totalRsd.toLocaleString("sr-RS")} RSD
            </Text>
          ) : null}

          {formattedDate ? (
            <Text style={[s.receiptDate, { color: theme.textMuted ?? theme.textSecondary }]}>
              {formattedDate}
            </Text>
          ) : null}

          {/* Divider */}
          <View style={[s.receiptDivider, { borderColor: theme.border }]} />

          {/* Points row */}
          {isPending ? (
            <Text style={[s.receiptReviewText, { color: theme.textSecondary }]}>
              {t("largeReceiptReview", "Large receipts go through manual review. Points will appear soon.")}
            </Text>
          ) : (
            <View style={s.receiptPointsRows}>
              <View style={s.receiptPointsRow}>
                <Text style={[s.receiptPointsLabel, { color: theme.textSecondary }]}>
                  {t("receiptPoints", "Receipt")}
                </Text>
                <Text style={[s.receiptPointsValue, { color: accentColor }]}>
                  +{pointsEarned - (streakBonus ?? 0)} pts
                </Text>
              </View>
              {streakBonus ? (
                <View style={s.receiptPointsRow}>
                  <Text style={[s.receiptPointsLabel, { color: theme.textSecondary }]}>
                    🔥 {t("streakBonus", "Streak bonus")}
                  </Text>
                  <Text style={[s.receiptPointsValue, { color: accentColor }]}>
                    +{streakBonus} pts
                  </Text>
                </View>
              ) : null}
              <View style={[s.receiptPointsRow, s.receiptTotalRow]}>
                <Text style={[s.receiptTotalLabel, { color: theme.text }]}>
                  {t("total", "Total")}
                </Text>
                <Text style={[s.receiptTotalValue, { color: accentColor }]}>
                  +{pointsEarned} pts
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : !isPending ? (
        <Text style={[s.donePoints, { color: accentColor }]}>+{pointsEarned} pts</Text>
      ) : null}

      <Pressable
        onPress={onClose}
        style={[s.btn, { backgroundColor: isRainbow ? "#F2F2F6" : colors.skySolid, marginTop: 24, paddingHorizontal: 48 }]}
      >
        <Text style={{ color: isRainbow ? theme.text : "#FFF", fontWeight: "700", fontSize: 16 }}>
          {t("done", "Done")}
        </Text>
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
  modeRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  modeBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.skySolid,
  },
  modeBtnText: { fontSize: 14, fontWeight: "700" },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
  frame: { width: "100%", aspectRatio: 0.6, borderWidth: 2, borderColor: "#FFF", borderRadius: 30, opacity: 0.86 },
  frameQr: { width: 220, aspectRatio: 1, borderRadius: 16 },
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
  doneIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  doneIcon: { fontSize: 40 },
  doneTitle: { fontSize: 24, fontFamily: fonts.displayHeavy, textAlign: "center" },
  donePoints: { fontSize: 32, fontWeight: "800", marginTop: 12 },
  receiptCard: {
    width: "100%",
    marginTop: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 4,
  },
  receiptVendor: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  receiptAmount: { fontSize: 15 },
  receiptDate: { fontSize: 12, marginTop: 2 },
  receiptDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 14 },
  receiptPointsRows: { gap: 8 },
  receiptPointsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  receiptTotalRow: { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.08)" },
  receiptPointsLabel: { fontSize: 14 },
  receiptPointsValue: { fontSize: 14, fontWeight: "700" },
  receiptTotalLabel: { fontSize: 16, fontWeight: "700" },
  receiptTotalValue: { fontSize: 22, fontWeight: "800" },
  receiptReviewText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
})
