import { useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter, Stack } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import { trpc } from "../src/lib/trpc"
import { fonts, useTheme } from "../src/lib/theme"
import { IS_TELEGRAM, getTgWebApp } from "../src/lib/telegram"

// ── Device (Teenage-Engineering) tokens ──
const ORANGE = "#fd4600"
const ORANGE_EDGE = "#c83700"
const GREEN = "#013d24"
const INK = "#015634"
const CREAM = "#efeeea"
const LCD_EDGE = "#C4C4BE"
const EDGE = "rgba(110,102,86,0.18)"
const HILITE = "rgba(255,255,255,0.95)"

type Phase =
  | { kind: "camera" }
  | { kind: "submitting" }
  | { kind: "error"; message: string; alreadyUsed?: boolean }
  | {
      kind: "done"
      pointsEarned: number
      offerTitle?: string
      vendorName?: string
      totalRsd?: number
      date?: string
      isPartnerReceipt?: boolean
    }

export default function ScanScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()

  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "camera" })

  const redeemOfferMutation = trpc.offer.redeem.useMutation()
  const scanReceiptMutation = trpc.transaction.scanQrReceipt.useMutation()

  function openTelegramScanner() {
    const tg = getTgWebApp()
    if (!tg?.showScanQrPopup) {
      setPhase({ kind: "error", message: t("scanFailed", "Scan failed") + ": Telegram QR unavailable" })
      return
    }
    setPhase({ kind: "camera" })
    setTimeout(() => {
      tg.showScanQrPopup({ text: "Point at the QR code on the fiscal receipt" }, (data: string) => {
        tg.closeScanQrPopup?.()
        void handleQrScanned(data)
        return true
      })
    }, 50)
  }

  async function handleQrScanned(data: string) {
    if (phase.kind === "submitting" || phase.kind === "done") return
    setPhase({ kind: "submitting" })

    try {
      const offerMatch = data.match(/^ayoo:\/\/offer\/(.+)$/)
      if (offerMatch) {
        const res = await redeemOfferMutation.mutateAsync({ token: offerMatch[1]! })
        utils.user.me.invalidate()
        setPhase({ kind: "done", pointsEarned: res.pointsEarned, offerTitle: res.offerTitle })
        return
      }

      if (data.includes("suf.purs.gov.rs")) {
        const res = await scanReceiptMutation.mutateAsync({ qrUrl: data })
        utils.user.me.invalidate()
        setPhase({
          kind: "done",
          pointsEarned: res.pointsEarned,
          vendorName: res.vendorName,
          totalRsd: res.totalRsd,
          date: res.date,
          isPartnerReceipt: res.isPartnerReceipt,
        })
        return
      }

      setPhase({
        kind: "error",
        message: t("unknownQr", "Unknown QR code") + "\n\n" + t("unknownQrDesc", "This QR is not a recognised ayoo code."),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const alreadyUsed = msg.toLowerCase().includes("already") || msg.includes("CONFLICT")
      setPhase({ kind: "error", message: alreadyUsed ? "" : t("scanFailed", "Scan failed") + "\n\n" + msg, alreadyUsed })
    }
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("scanQrCode", "Scan QR"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        {phase.kind === "camera" ? (
          IS_TELEGRAM ? (
            <TelegramPhase onScanner={openTelegramScanner} theme={theme} t={t} />
          ) : (
            <CameraPhase
              permission={permission}
              requestPermission={requestPermission}
              cameraRef={cameraRef}
              onQrScanned={handleQrScanned}
              theme={theme}
            />
          )
        ) : phase.kind === "submitting" ? (
          <LoadingPhase label={t("submitting", "Submitting…")} theme={theme} />
        ) : phase.kind === "error" ? (
          <ErrorPhase
            message={phase.message}
            alreadyUsed={phase.alreadyUsed}
            onRetry={() => setPhase({ kind: "camera" })}
            theme={theme}
          />
        ) : (
          <DonePhase
            pointsEarned={phase.pointsEarned}
            offerTitle={phase.offerTitle}
            vendorName={phase.vendorName}
            totalRsd={phase.totalRsd}
            date={phase.date}
            isPartnerReceipt={phase.isPartnerReceipt}
            onClose={() => router.back()}
            theme={theme}
          />
        )}
      </View>
    </>
  )
}

// ── TelegramPhase ─────────────────────────────────────────────

function TelegramPhase({
  onScanner, theme, t,
}: {
  onScanner: () => void
  theme: ReturnType<typeof useTheme>
  t: (key: string, fallback: string) => string
}) {
  return (
    <View style={[s.center, { padding: 32, gap: 16 }]}>
      <Text style={{ fontSize: 72 }}>📷</Text>
      <Text style={[s.title, { color: theme.text }]}>
        {t("scanQrCode", "Scan receipt QR")}
      </Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        {t("pointAtPartnerQr", "Scan a Serbian fiscal receipt or an ayoo offer QR to earn points.")}
      </Text>
      <Pressable onPress={onScanner} style={[s.btn, s.btnPrimary, { paddingHorizontal: 32 }]}>
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
          {t("openScanner", "Open scanner")}
        </Text>
      </Pressable>
    </View>
  )
}

// ── CameraPhase ───────────────────────────────────────────────

function CameraPhase({
  permission, requestPermission, cameraRef, onQrScanned, theme,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: ReturnType<typeof useCameraPermissions>[1]
  cameraRef: { current: CameraView | null }
  onQrScanned: (data: string) => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")
  const [scanned, setScanned] = useState(false)

  if (!permission) return <View style={s.center}><ActivityIndicator color={ORANGE} /></View>

  if (!permission.granted) {
    return (
      <View style={[s.center, { padding: 24 }]}>
        <Text style={[s.title, { color: theme.text }]}>{t("cameraNeeded", "Camera access needed")}</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>
          {t("cameraNeededDesc", "ayoo needs your camera to scan QR codes.")}
        </Text>
        <Pressable onPress={requestPermission} style={[s.btn, s.btnSecondary]}>
          <Text style={[s.btnSecondaryText, { fontFamily: fonts.displayHeavy }]}>
            {t("grantAccess", "Grant access")}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={s.cameraWrap}>
      <CameraView
        ref={cameraRef}
        style={s.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={!scanned ? (e) => { setScanned(true); onQrScanned(e.data) } : undefined}
      />
      <View style={s.overlay}>
        <View style={s.frame} />
        <Text style={s.frameHint}>{t("frameQrHint", "Point at the QR code")}</Text>
      </View>
    </View>
  )
}

// ── LoadingPhase ──────────────────────────────────────────────

function LoadingPhase({ label, theme }: { label: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={ORANGE} />
      <Text style={[s.loadingLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  )
}

// ── ErrorPhase ────────────────────────────────────────────────

function ErrorPhase({
  message, alreadyUsed, onRetry, theme,
}: {
  message: string
  alreadyUsed?: boolean
  onRetry: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")
  return (
    <View style={[s.center, { padding: 28 }]}>
      <Text style={{ fontSize: 52, marginBottom: 12 }}>{alreadyUsed ? "🧾" : "⚠️"}</Text>
      <Text style={[s.doneTitle, { color: theme.text, marginBottom: 12 }]}>
        {alreadyUsed ? t("offerAlreadyUsed", "Already used") : t("scanFailed", "Scan failed")}
      </Text>
      {alreadyUsed ? (
        <Text style={[s.subtitle, { color: theme.textSecondary, textAlign: "center" }]}>
          {t("offerAlreadyUsedDesc", "This QR code has already been redeemed.")}
        </Text>
      ) : message ? (
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: "#FFD0D0" }]}>
          <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }}>{message}</Text>
        </View>
      ) : null}
      <Pressable onPress={onRetry} style={[s.btn, s.btnPrimary, { marginTop: 24, paddingHorizontal: 40 }]}>
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>{t("tryAgain", "Try again")}</Text>
      </Pressable>
    </View>
  )
}

// ── DonePhase ─────────────────────────────────────────────────

function DonePhase({
  pointsEarned, offerTitle, vendorName, totalRsd, date, isPartnerReceipt, onClose, theme,
}: {
  pointsEarned: number
  offerTitle?: string
  vendorName?: string
  totalRsd?: number
  date?: string
  isPartnerReceipt?: boolean
  onClose: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("common")
  return (
    <View style={[s.center, { padding: 24 }]}>
      <View style={[s.doneIconWrap, { backgroundColor: "#E8FFF4", borderColor: LCD_EDGE }]}>
        <Text style={s.doneIcon}>✅</Text>
      </View>
      <Text style={[s.doneTitle, { color: theme.text, marginTop: 16 }]}>
        {t("pointsAwarded", "Points awarded!")}
      </Text>
      {offerTitle || vendorName ? (
        <View style={[s.card, { backgroundColor: CREAM, borderColor: theme.border, marginTop: 20 }]}> 
          <Text style={[s.cardVendor, { color: theme.text }]}>{offerTitle ?? vendorName}</Text>
          {totalRsd !== undefined ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {totalRsd.toLocaleString("sr-RS")} RSD{date ? ` · ${date}` : ""}
            </Text>
          ) : null}
          {isPartnerReceipt !== undefined ? (
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 3 }}>
              {isPartnerReceipt ? t("partnerReceiptRate", "Partner rate applied") : t("baseReceiptRate", "ayoo 1% reward")}
            </Text>
          ) : null}
          <View style={[s.divider, { borderColor: theme.border }]} />
          <Text style={[s.cardPoints, { color: GREEN }]}>+{pointsEarned} pts</Text>
        </View>
      ) : (
        <Text style={[s.bigPoints, { color: GREEN }]}>+{pointsEarned} pts</Text>
      )}
      <Pressable onPress={onClose} style={[s.btn, s.btnPrimary, { marginTop: 24, paddingHorizontal: 48 }]}>
        <Text style={[s.btnPrimaryText, { fontFamily: fonts.displayHeavy }]}>{t("done", "Done")}</Text>
      </Pressable>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
  frame: { width: 220, aspectRatio: 1, borderWidth: 2, borderColor: "#FFF", borderRadius: 16, opacity: 0.86 },
  frameHint: {
    color: "#FFF", marginTop: 12, fontSize: 13, fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  loadingLabel: { fontSize: 13, marginTop: 14 },
  title: { fontSize: 24, fontFamily: fonts.displayHeavy, color: INK, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 13, marginBottom: 20, textAlign: "center", lineHeight: 18 },
  doneIconWrap: { width: 80, height: 80, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  doneIcon: { fontSize: 40 },
  doneTitle: { fontSize: 24, fontFamily: fonts.displayHeavy, textAlign: "center" },
  bigPoints: { fontSize: 30, fontFamily: fonts.pixel, marginTop: 12 },
  card: {
    width: "100%", borderRadius: 16, padding: 20, gap: 4,
    borderTopWidth: 1.5, borderTopColor: HILITE,
    borderBottomWidth: 5, borderBottomColor: EDGE,
  },
  cardVendor: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  cardPoints: { fontSize: 22, fontWeight: "800" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 14 },
  btn: {
    padding: 15, borderRadius: 16, alignItems: "center",
    borderTopWidth: 1.5, borderTopColor: HILITE,
    borderBottomWidth: 5, borderBottomColor: EDGE,
    shadowColor: "#9A958A", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 5,
  },
  btnPrimary: { backgroundColor: ORANGE, borderBottomColor: ORANGE_EDGE, borderTopColor: "rgba(255,255,255,0.5)" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 16 },
  btnSecondary: { backgroundColor: CREAM },
  btnSecondaryText: { color: INK, fontSize: 16 },
})
