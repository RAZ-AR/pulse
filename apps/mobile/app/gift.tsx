import { useState } from "react"
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { IconPlane } from "../src/components/icons"
import { Stack, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../src/lib/trpc"
import { fonts, useTheme } from "../src/lib/theme"
import { ModeHeader } from "../src/components/gadget"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT } from "@pulse/shared"

const PRESETS = [100, 250, 500]

// ── Device (Teenage-Engineering) tokens ──
const CREAM = "#efeeea"
const INK = "#015634"
const DIM = "#8C887E"
const ORANGE = "#fd4600"
const ORANGE_EDGE = "#c83700"
const GREEN = "#013d24"
const LCD = "#DBDBD7"
const LCD_EDGE = "#C4C4BE"
const LCD_INK = "#015634"
const EDGE = "rgba(110,102,86,0.18)"
const HILITE = "rgba(255,255,255,0.95)"

type DoneData = { shareUrl: string; shareText: string; amount: number }

export default function GiftScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation("gift")
  const utils = trpc.useUtils()

  const status = trpc.social.giftStatus.useQuery()
  const history = trpc.social.giftLinkHistory.useQuery({ limit: 10 })

  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState<DoneData | null>(null)

  const earnedPoints = status.data?.earnedPoints ?? 0
  const remainingDailyLimit = status.data?.remainingDailyLimit ?? GIFT_DAILY_LIMIT
  const sentToday = status.data?.sentToday ?? 0
  const maxGiftNow = Math.max(0, Math.min(earnedPoints, remainingDailyLimit))
  const progress = Math.min(1, sentToday / GIFT_DAILY_LIMIT)
  const amountNumber = parseInt(amount, 10)
  const canSend =
    !Number.isNaN(amountNumber) &&
    amountNumber >= GIFT_MIN_AMOUNT &&
    amountNumber <= maxGiftNow

  const createLink = trpc.social.createGiftLink.useMutation({
    onSuccess: async (data: { shareUrl: string; shareText: string; amount: number; token: string; expiresAt: Date }) => {
      utils.user.me.invalidate()
      utils.social.giftStatus.invalidate()
      setDone({ shareUrl: data.shareUrl, shareText: data.shareText, amount: data.amount })
      await Share.share({ message: data.shareText, url: data.shareUrl })
    },
    onError: (e: { message: string }) => setError(e.message),
  })

  function selectPreset(value: number) {
    setAmount(String(value))
    setError("")
  }

  function send() {
    setError("")
    const n = parseInt(amount, 10)
    if (Number.isNaN(n) || n < GIFT_MIN_AMOUNT) {
      setError(t("errMin", "Minimum {{n}} pts", { n: GIFT_MIN_AMOUNT }))
      return
    }
    if (n > earnedPoints) {
      setError(t("errBalance", "Not enough earned points"))
      return
    }
    if (n > remainingDailyLimit) {
      setError(t("errDailyLimit", "Daily limit: {{n}} pts", { n: remainingDailyLimit }))
      return
    }
    createLink.mutate({
      amount: n,
      ...(message.trim() ? { message: message.trim() } : {}),
    })
  }

  function shareAgain() {
    if (!done) return
    Share.share({ message: done.shareText, url: done.shareUrl })
  }

  function reset() {
    setDone(null)
    setAmount("")
    setMessage("")
    setError("")
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <ModeHeader kicker="GIFT" title={t("title", "Gift points")} />
          {/* ── Balance hero — cream device card with a recessed LCD ── */}
          <View style={s.hero}>
            <View style={s.heroLcd}>
              <View style={s.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.kicker, { fontFamily: fonts.pixel }]}>{t("availableToGift", "Available to gift").toUpperCase()}</Text>
                  <Text style={[s.heroValue, { fontFamily: fonts.pixel }]}>{maxGiftNow.toLocaleString()} PTS</Text>
                </View>
                <View style={s.limitChip}>
                  <Text style={[s.limitChipValue, { fontFamily: fonts.pixel }]}>{remainingDailyLimit}</Text>
                  <Text style={[s.limitChipLabel, { fontFamily: fonts.pixel }]}>{t("remaining", "left").toUpperCase()}</Text>
                </View>
              </View>
              <View style={s.limitTrack}>
                <View style={[s.limitFill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={s.heroMeta}>
                <Text style={[s.metaText, { fontFamily: fonts.pixel }]}>{sentToday} {t("sentToday", "sent today").toUpperCase()}</Text>
                <Text style={[s.metaText, { fontFamily: fonts.pixel }]}>{GIFT_DAILY_LIMIT} {t("dailyLimit", "daily limit").toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {done ? (
            // ── Done state ────────────────────────────────────────
            <View style={s.doneWrap}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🎁</Text>
              <Text style={[s.doneTitle, { color: INK, fontFamily: fonts.displayHeavy }]}>{t("linkCreated", "Link created!")}</Text>
              <Text style={[s.doneSub, { color: DIM }]}>
                {done.amount} pts — {t("linkShared", "link opened for sharing")}
              </Text>
              <Text style={[s.doneHint, { color: DIM }]}>
                {t("doneHint", "Points will be credited when your friend opens the link")}
              </Text>

              {/* QR with the gift link — scan to claim the points */}
              <View style={s.qrCard}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=0&data=${encodeURIComponent(done.shareUrl)}` }}
                  style={s.qrImg}
                />
              </View>
              <Text style={[s.doneHint, { color: DIM }]}>
                {t("qrHint", "A friend or partner scans it — the points go to them")}
              </Text>

              <Pressable onPress={shareAgain} style={({ pressed }) => [s.mainCta, pressed && s.keyPressed]}>
                <View style={s.ctaRow}>
                  <IconPlane color="#FFFFFF" size={20} />
                  <Text style={[s.ctaText, { color: "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{t("shareAgain", "Share again")}</Text>
                </View>
              </Pressable>
              <Pressable onPress={reset} style={s.secondaryPressable}>
                <Text style={[s.secondaryText, { color: DIM, fontFamily: fonts.pixel }]}>{t("sendAnother", "Send another").toUpperCase()}</Text>
              </Pressable>
            </View>
          ) : (
            // ── Compose state ─────────────────────────────────────
            <>
              <View style={s.sectionHead}>
                <Text style={[s.sectionMark, { fontFamily: fonts.pixel }]}>▸</Text>
                <Text style={[s.sectionTitle, { color: INK, fontFamily: fonts.displayHeavy }]}>{t("howMuch", "How much to gift?")}</Text>
              </View>

              {/* Preset keys */}
              <View style={s.presetRow}>
                {PRESETS.map((value) => {
                  const selected = amount === String(value)
                  const disabled = value > maxGiftNow
                  return (
                    <Pressable
                      key={value}
                      onPress={() => !disabled && selectPreset(value)}
                      style={({ pressed }) => [s.preset, selected && s.presetActive, disabled && s.presetOff, pressed && !disabled && s.keyPressed]}
                    >
                      <Text style={[s.presetText, { fontFamily: fonts.pixel, color: selected ? ORANGE_EDGE : DIM }]}>{value}</Text>
                    </Pressable>
                  )
                })}
              </View>

              {/* Custom amount — recessed LCD input */}
              <Text style={[s.label, { fontFamily: fonts.pixel }]}>{t("customAmount", "Custom amount").toUpperCase()}</Text>
              <View style={s.inputWrap}>
                <TextInput
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v.replace(/[^0-9]/g, ""))
                    setError("")
                  }}
                  placeholder={t("minAmount", "from {{n}}", { n: GIFT_MIN_AMOUNT })}
                  placeholderTextColor={DIM}
                  keyboardType="number-pad"
                  style={[s.input, { color: LCD_INK, fontFamily: fonts.pixel }]}
                />
              </View>

              {/* Optional message */}
              <Text style={[s.label, { fontFamily: fonts.pixel }]}>
                {t("message", "Message").toUpperCase()} <Text style={s.optional}>· {t("optional", "optional")}</Text>
              </Text>
              <View style={s.messageWrap}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("messagePlaceholder", "For coffee tomorrow ☕")}
                  placeholderTextColor={DIM}
                  maxLength={200}
                  multiline
                  style={[s.messageInput, { color: INK, fontFamily: fonts.body }]}
                />
              </View>

              {error ? <Text style={s.err}>{error}</Text> : null}

              {/* Main CTA — solid orange device key */}
              <Pressable
                onPress={send}
                disabled={createLink.isPending || !canSend}
                style={({ pressed }) => [s.mainCta, (createLink.isPending || !canSend) && s.ctaOff, pressed && !(createLink.isPending || !canSend) && s.keyPressed]}
              >
                {createLink.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={s.ctaRow}>
                    <IconPlane color="#FFFFFF" size={20} />
                    <Text style={[s.ctaText, { color: "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{t("giftBtn", "Gift")}</Text>
                  </View>
                )}
              </Pressable>

              <Text style={[s.hint, { color: DIM }]}>
                {t("shareHint", "Telegram, WhatsApp or another sharing method will open")}
              </Text>
            </>
          )}

          {/* ── История отправленных подарков ── */}
          {(history.data?.length ?? 0) > 0 ? (
            <>
              <View style={[s.sectionHead, { marginTop: 28 }]}>
                <Text style={[s.sectionMark, { fontFamily: fonts.pixel }]}>▸</Text>
                <Text style={[s.sectionTitle, { color: INK, fontFamily: fonts.displayHeavy }]}>{t("history", "History")}</Text>
              </View>
              <View style={s.historyList}>
                {history.data!.map((link) => {
                  const claimed = link.status === "CLAIMED"
                  const expired = link.status === "EXPIRED"
                  return (
                    <View key={link.id} style={s.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.historyAmount, { color: claimed ? GREEN : INK, fontFamily: fonts.pixel }]}>
                          {link.amount} PTS
                        </Text>
                        {link.recipient ? (
                          <Text style={[s.historyMeta, { color: DIM }]}>
                            → {link.recipient.name ?? t("unknownUser", "user")}
                          </Text>
                        ) : null}
                        {link.message ? (
                          <Text style={[s.historyMeta, { color: DIM }]} numberOfLines={1}>{link.message}</Text>
                        ) : null}
                      </View>
                      <View style={[s.historyStatus, claimed ? s.statusClaimed : expired ? s.statusExpired : s.statusPending]}>
                        <Text style={[s.historyStatusText, { fontFamily: fonts.pixel, color: claimed ? GREEN : expired ? DIM : ORANGE_EDGE }]}>
                          {claimed ? t("statusClaimed", "received") : expired ? t("statusExpired", "expired") : t("statusPending", "waiting")}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const clayCard = {
  backgroundColor: CREAM,
  borderTopWidth: 1.5,
  borderTopColor: HILITE,
  borderBottomWidth: 5,
  borderBottomColor: EDGE,
  shadowColor: "#9A958A",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.32,
  shadowRadius: 18,
  elevation: 6,
} as const

const lcdPlate = {
  backgroundColor: LCD,
  borderWidth: 2,
  borderColor: LCD_EDGE,
} as const

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 60 },

  // ── Hero ──
  hero: { ...clayCard, borderRadius: 26, padding: 12, marginBottom: 22 },
  heroLcd: { ...lcdPlate, borderRadius: 16, padding: 16 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  kicker: { fontSize: 7, letterSpacing: 0.5, color: DIM, marginBottom: 10, lineHeight: 11 },
  heroValue: { fontSize: 22, color: LCD_INK },
  limitChip: { ...lcdPlate, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", backgroundColor: "#efeeea", gap: 4 },
  limitChipValue: { color: LCD_INK, fontSize: 14 },
  limitChipLabel: { color: DIM, fontSize: 6, letterSpacing: 0.5 },
  limitTrack: { height: 14, borderRadius: 7, backgroundColor: "#CFCFC9", marginTop: 16, overflow: "hidden", borderWidth: 1, borderColor: LCD_EDGE },
  limitFill: { height: "100%", borderRadius: 7, backgroundColor: ORANGE },
  heroMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, gap: 8 },
  metaText: { fontSize: 6, lineHeight: 10, color: DIM },

  // ── Section header ──
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionMark: { fontSize: 9, color: ORANGE },
  sectionTitle: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },

  // ── Preset keys ──
  presetRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  preset: {
    flex: 1,
    ...clayCard,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  presetActive: { borderBottomColor: ORANGE, borderBottomWidth: 5 },
  presetOff: { opacity: 0.4 },
  presetText: { fontSize: 15 },
  keyPressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }], shadowOpacity: 0.12 },

  // ── Inputs ──
  label: { fontSize: 7, letterSpacing: 0.5, color: DIM, marginBottom: 8 },
  optional: { fontSize: 7, color: DIM },
  inputWrap: { ...lcdPlate, borderRadius: 14, marginBottom: 16 },
  input: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 22, lineHeight: 28 },
  messageWrap: { ...lcdPlate, backgroundColor: "#efeeea", borderRadius: 14, marginBottom: 14 },
  messageInput: { padding: 16, fontSize: 15, minHeight: 86, textAlignVertical: "top" },

  err: { color: "#fd4600", fontSize: 13, marginBottom: 10 },

  // ── CTA ──
  mainCta: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.5)",
    borderBottomWidth: 5,
    borderBottomColor: ORANGE_EDGE,
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaOff: { opacity: 0.45 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  ctaText: { fontSize: 16 },
  hint: { fontSize: 12, textAlign: "center", lineHeight: 18 },

  // ── Done ──
  doneWrap: { alignItems: "center", paddingTop: 10 },
  doneTitle: { fontSize: 28, lineHeight: 32 },
  doneSub: { fontSize: 15, marginTop: 8, textAlign: "center" },
  doneHint: { fontSize: 12, marginTop: 6, marginBottom: 20, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  qrCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 2, borderColor: LCD_EDGE },
  qrImg: { width: 200, height: 200 },
  secondaryPressable: { padding: 12, alignItems: "center", marginTop: 4 },
  secondaryText: { fontSize: 8, letterSpacing: 0.5 },

  // ── History ──
  historyList: { gap: 8 },
  historyRow: { ...clayCard, flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, gap: 10, borderBottomWidth: 4 },
  historyAmount: { fontSize: 13 },
  historyMeta: { fontSize: 12, marginTop: 4 },
  historyStatus: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1 },
  statusClaimed: { backgroundColor: "#DCEFE6", borderColor: "rgba(95,174,146,0.4)" },
  statusExpired: { backgroundColor: "#efeeea", borderColor: EDGE },
  statusPending: { backgroundColor: "#F6E2D2", borderColor: "rgba(217,138,78,0.4)" },
  historyStatusText: { fontSize: 7, letterSpacing: 0.5 },
})
