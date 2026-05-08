import { useMemo, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, gradients, useTheme } from "../src/lib/theme"
import { LavaLampSurface, NeuCard, NeuInset } from "../src/components/neu"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT } from "@pulse/shared"

type Recipient = { id: string; name: string | null; avatarUrl: string | null; code: string }
type Phase =
  | { kind: "lookup" }
  | { kind: "compose"; recipient: Recipient }
  | { kind: "done"; recipientName: string; sent: number; remaining: number }

const PRESETS = [50, 100, 250, 500]

export default function GiftScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()

  const status = trpc.social.giftStatus.useQuery()
  const lookupQuery = utils.user.findByReferralCode

  const [phase, setPhase] = useState<Phase>({ kind: "lookup" })
  const [code, setCode] = useState("")
  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLookingUp, setIsLookingUp] = useState(false)

  const earnedPoints = status.data?.earnedPoints ?? 0
  const remainingDailyLimit = status.data?.remainingDailyLimit ?? GIFT_DAILY_LIMIT
  const sentToday = status.data?.sentToday ?? 0
  const maxGiftNow = Math.max(0, Math.min(earnedPoints, remainingDailyLimit))
  const progress = Math.min(1, sentToday / GIFT_DAILY_LIMIT)
  const amountNumber = parseInt(amount, 10)
  const canSend =
    phase.kind === "compose" &&
    !Number.isNaN(amountNumber) &&
    amountNumber >= GIFT_MIN_AMOUNT &&
    amountNumber <= maxGiftNow
  const amountRangeLabel = maxGiftNow >= GIFT_MIN_AMOUNT
    ? `${GIFT_MIN_AMOUNT}-${maxGiftNow} pts`
    : t("noGiftPointsAvailable", "0 pts available")

  const presetValues = useMemo(
    () => PRESETS.filter((value) => value >= GIFT_MIN_AMOUNT && value <= maxGiftNow),
    [maxGiftNow],
  )

  const sendGift = trpc.social.gift.useMutation({
    onSuccess: (data) => {
      utils.user.me.invalidate()
      utils.social.giftStatus.invalidate()
      setPhase({
        kind: "done",
        recipientName: data.toUser,
        sent: data.sent,
        remaining: data.remainingDailyLimit,
      })
    },
    onError: (e) => setError(e.message),
  })

  async function lookup() {
    setError("")
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    setCode(c)
    if (c.length !== 6) {
      setError(t("invalidCode", "Enter a 6-character code"))
      return
    }
    try {
      setIsLookingUp(true)
      const recipient = await lookupQuery.fetch({ code: c })
      setPhase({ kind: "compose", recipient: { ...recipient, code: c } })
    } catch (e) {
      setError(e instanceof Error ? e.message : t("notFound", "User not found"))
    } finally {
      setIsLookingUp(false)
    }
  }

  function selectPreset(value: number) {
    setAmount(String(value))
    setError("")
  }

  function send() {
    if (phase.kind !== "compose") return
    setError("")
    const n = parseInt(amount, 10)
    if (Number.isNaN(n) || n < GIFT_MIN_AMOUNT) {
      setError(t("minAmountErr", `Minimum is ${GIFT_MIN_AMOUNT} pts`, { min: GIFT_MIN_AMOUNT }))
      return
    }
    if (n > earnedPoints) {
      setError(t("notEnoughGiftPoints", "Not enough earned points to gift"))
      return
    }
    if (n > remainingDailyLimit) {
      setError(t("giftLimitErr", `You can gift ${remainingDailyLimit} pts today`, { remaining: remainingDailyLimit }))
      return
    }
    sendGift.mutate({
      receiverId: phase.recipient.id,
      amount: n,
      ...(message.trim() ? { message: message.trim() } : {}),
    })
  }

  function resetFlow() {
    setPhase({ kind: "lookup" })
    setCode("")
    setAmount("")
    setMessage("")
    setError("")
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("giftPoints", "Gift points"),
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <LavaLampSurface style={s.hero} contentStyle={s.heroContent} intensity="glass">
            <View style={s.heroTop}>
              <View>
                <Text style={[s.kicker, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                  {t("availableEarned", "Available to gift").toUpperCase()}
                </Text>
                <Text style={[s.heroValue, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                  {earnedPoints.toLocaleString()} pts
                </Text>
              </View>
              <View style={s.limitOrb}>
                <Text style={[s.limitOrbValue, { fontFamily: fonts.displayHeavy }]}>{remainingDailyLimit}</Text>
                <Text style={[s.limitOrbLabel, { fontFamily: fonts.bodyBold }]}>{t("left", "left")}</Text>
              </View>
            </View>
            <View style={s.limitTrack}>
              <View style={[s.limitFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={s.heroMeta}>
              <Text style={[s.metaText, { color: theme.textSecondary }]}>{sentToday} pts {t("sentToday", "sent today")}</Text>
              <Text style={[s.metaText, { color: theme.textSecondary }]}>{GIFT_DAILY_LIMIT} pts {t("dailyLimit", "daily limit")}</Text>
            </View>
          </LavaLampSurface>

          {phase.kind === "lookup" ? (
            <>
              <View style={s.sectionHead}>
                <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                  {t("findFriend", "Find your friend")}
                </Text>
                <Text style={[s.subtitle, { color: theme.textSecondary }]}>
                  {t("giftHint", "Enter their 6-character referral code from their PULSE profile")}
                </Text>
              </View>

              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("referralCode", "Referral code").toUpperCase()}
              </Text>
              <NeuInset style={s.inputWrap}>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    setError("")
                  }}
                  onSubmitEditing={lookup}
                  placeholder="ABC123"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={[s.codeInput, { color: theme.text, fontFamily: fonts.bodyBold }]}
                />
              </NeuInset>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <NeuCard
                gradient={gradients.lavaGlass}
                onPress={lookup}
                disabled={isLookingUp}
                style={s.mainCta}
              >
                {isLookingUp ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={[s.cta, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                    {t("findFriendBtn", "Find friend")}
                  </Text>
                )}
              </NeuCard>
            </>
          ) : phase.kind === "compose" ? (
            <>
              <NeuCard gradient={gradients.lavaGlass} style={s.recipientCard}>
                <View style={s.avatar}>
                  <Text style={[s.avatarLetter, { fontFamily: fonts.displayHeavy }]}>
                    {(phase.recipient.name?.[0] ?? "P").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.recipientLabel, { fontFamily: fonts.bodyBold }]}>{t("sendTo", "Send to").toUpperCase()}</Text>
                  <Text style={[s.recipientName, { fontFamily: fonts.displayHeavy }]}>
                    {phase.recipient.name ?? t("unnamedUser", "User")}
                  </Text>
                  <Text style={[s.recipientCode, { fontFamily: fonts.bodyBold }]}>{phase.recipient.code}</Text>
                </View>
              </NeuCard>

              <View style={s.amountHeader}>
                <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                  {t("amount", "Amount").toUpperCase()}
                </Text>
                <Text style={[s.range, { color: theme.textSecondary }]}>
                  {amountRangeLabel}
                </Text>
              </View>
              <View style={s.presetRow}>
                {presetValues.map((value) => (
                  <Pressable key={value} onPress={() => selectPreset(value)} style={s.presetPressable}>
                    <NeuCard small gradient={amount === String(value) ? gradients.pinkBlue : gradients.pearl} style={s.preset}>
                      <Text style={[s.presetText, { color: theme.text, fontFamily: fonts.bodyBold }]}>{value}</Text>
                    </NeuCard>
                  </Pressable>
                ))}
              </View>
              <NeuInset style={s.inputWrap}>
                <TextInput
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v.replace(/[^0-9]/g, ""))
                    setError("")
                  }}
                  placeholder={`${GIFT_MIN_AMOUNT}`}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  style={[s.input, { color: theme.text, fontFamily: fonts.displayHeavy }]}
                />
              </NeuInset>

              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("message", "Message").toUpperCase()} <Text style={s.optional}>· {t("optional", "optional")}</Text>
              </Text>
              <NeuInset style={s.messageWrap}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("messagePlaceholder", "For coffee tomorrow")}
                  placeholderTextColor={theme.textMuted}
                  maxLength={200}
                  multiline
                  style={[s.messageInput, { color: theme.text, fontFamily: fonts.body }]}
                />
              </NeuInset>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <View style={s.btnRow}>
                <Pressable onPress={() => { setPhase({ kind: "lookup" }); setAmount(""); setMessage(""); setError("") }} style={{ flex: 0.38 }}>
                  <NeuCard small style={s.secondaryBtn}>
                    <Text style={{ color: theme.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{t("back", "Back")}</Text>
                  </NeuCard>
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sendGift.isPending || !canSend}
                  style={{ flex: 0.62, opacity: sendGift.isPending || !canSend ? 0.55 : 1 }}
                >
                  <NeuCard gradient={gradients.pinkBlue} style={s.primaryBtn}>
                    {sendGift.isPending ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={[s.cta, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{t("sendGift", "Send gift")}</Text>
                    )}
                  </NeuCard>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.doneWrap}>
              <LavaLampSurface style={s.doneOrb} contentStyle={s.doneOrbInner} intensity="glass">
                <Text style={[s.doneIcon, { color: theme.text, fontFamily: fonts.displayHeavy }]}>P</Text>
              </LavaLampSurface>
              <Text style={[s.doneTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {t("giftSent", "Gift sent!")}
              </Text>
              <Text style={[s.doneSub, { color: theme.textSecondary }]}>
                {phase.sent} pts {"->"} {phase.recipientName}
              </Text>
              <Text style={[s.doneRemain, { color: theme.textSecondary }]}>
                {phase.remaining} pts {t("remainingToday", "remaining to gift today")}
              </Text>
              <View style={s.btnRow}>
                <Pressable onPress={resetFlow} style={{ flex: 0.48 }}>
                  <NeuCard small style={s.secondaryBtn}>
                    <Text style={{ color: theme.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{t("sendMore", "Send more")}</Text>
                  </NeuCard>
                </Pressable>
                <Pressable onPress={() => router.back()} style={{ flex: 0.52 }}>
                  <NeuCard gradient={gradients.pinkBlue} style={s.primaryBtn}>
                    <Text style={[s.cta, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{t("done", "Done")}</Text>
                  </NeuCard>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },

  hero: { borderRadius: 36, marginBottom: 22 },
  heroContent: { padding: 18 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  kicker: { fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 34, lineHeight: 38 },
  limitOrb: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#A3B1C6",
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 6, height: 8 },
  },
  limitOrbValue: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  limitOrbLabel: { color: "#91A1B4", fontSize: 10, textTransform: "uppercase" },
  limitTrack: {
    height: 18,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginTop: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
  },
  limitFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "rgba(241,153,227,0.58)",
  },
  heroMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaText: { fontSize: 11 },

  sectionHead: { marginBottom: 18 },
  title: { fontSize: 32, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20 },

  label: { fontSize: 11, letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: "500", letterSpacing: 0 },
  inputWrap: { marginBottom: 14, borderRadius: 24 },
  input: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 28, lineHeight: 34 },
  codeInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, letterSpacing: 5, textAlign: "center" },
  messageWrap: { marginBottom: 12, borderRadius: 24 },
  messageInput: { padding: 16, fontSize: 15, minHeight: 86, textAlignVertical: "top" },
  cta: { fontSize: 15 },
  err: { color: "#DC2626", fontSize: 13, marginBottom: 10 },
  mainCta: { padding: 15, alignItems: "center", borderRadius: 99 },

  recipientCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginBottom: 20, borderRadius: 32 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
  },
  avatarLetter: { color: colors.ink, fontSize: 24 },
  recipientLabel: { color: "#91A1B4", fontSize: 10, letterSpacing: 0.7 },
  recipientName: { color: colors.ink, fontSize: 21, lineHeight: 24, marginTop: 2 },
  recipientCode: { color: "#91A1B4", fontSize: 12, marginTop: 4, letterSpacing: 2 },

  amountHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  range: { fontSize: 11, marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  presetPressable: { flex: 1 },
  preset: { paddingVertical: 10, alignItems: "center", borderRadius: 18 },
  presetText: { fontSize: 13 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryBtn: { padding: 13, alignItems: "center", borderRadius: 99 },
  primaryBtn: { padding: 13, alignItems: "center", borderRadius: 99 },

  doneWrap: { alignItems: "center", paddingTop: 26 },
  doneOrb: { width: 142, height: 142, borderRadius: 71, marginBottom: 18 },
  doneOrbInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  doneIcon: { fontSize: 58, lineHeight: 64 },
  doneTitle: { fontSize: 34, lineHeight: 38 },
  doneSub: { fontSize: 15, marginTop: 8 },
  doneRemain: { fontSize: 12, marginTop: 4, marginBottom: 14 },
})
