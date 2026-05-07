import { useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, gradients, useTheme } from "../src/lib/theme"
import { NeuCard, NeuInset } from "../src/components/neu"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT } from "@pulse/shared"

type Recipient = { id: string; name: string | null; avatarUrl: string | null; code: string }
type Phase =
  | { kind: "lookup" }
  | { kind: "compose"; recipient: Recipient }
  | { kind: "done"; recipientName: string; sent: number; remaining: number }

export default function GiftScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()
  const me = trpc.user.me.useQuery()

  const [phase, setPhase] = useState<Phase>({ kind: "lookup" })
  const [code, setCode] = useState("")
  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const lookupQuery = trpc.useUtils().user.findByReferralCode

  const sendGift = trpc.social.gift.useMutation({
    onSuccess: (data) => {
      utils.user.me.invalidate()
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
    const c = code.trim().toUpperCase()
    if (c.length !== 6) {
      setError(t("invalidCode", "Enter a 6-character code"))
      return
    }
    try {
      const recipient = await lookupQuery.fetch({ code: c })
      setPhase({ kind: "compose", recipient: { ...recipient, code: c } })
    } catch (e) {
      setError(e instanceof Error ? e.message : t("notFound", "User not found"))
    }
  }

  function send() {
    if (phase.kind !== "compose") return
    setError("")
    const n = parseInt(amount, 10)
    if (isNaN(n) || n < GIFT_MIN_AMOUNT) {
      setError(t("minAmountErr", `Minimum is ${GIFT_MIN_AMOUNT} pts`, { min: GIFT_MIN_AMOUNT }))
      return
    }
    sendGift.mutate({
      receiverId: phase.recipient.id,
      amount: n,
      ...(message.trim() ? { message: message.trim() } : {}),
    })
  }

  const earnedPoints = me.data?.earnedPoints ?? 0

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
          {phase.kind === "lookup" ? (
            <>
              <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {t("findFriend", "Find your friend")}
              </Text>
              <Text style={[s.subtitle, { color: theme.textSecondary }]}>
                {t("giftHint", "Enter their 6-character referral code from their PULSE profile")}
              </Text>

              <NeuCard style={s.balanceTile}>
                <Text style={[s.balanceLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                  {t("availableEarned", "Available to gift").toUpperCase()}
                </Text>
                <Text style={[s.balanceValue, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                  {earnedPoints.toLocaleString()} pts
                </Text>
                <Text style={[s.balanceHint, { color: theme.textSecondary }]}>
                  {t("dailyLimit", "Daily limit")}: {GIFT_DAILY_LIMIT} pts
                </Text>
              </NeuCard>

              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("referralCode", "Referral code").toUpperCase()}
              </Text>
              <NeuInset style={{ marginBottom: 12 }}>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  onSubmitEditing={lookup}
                  placeholder="ABC123"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={[s.input, { color: theme.text, letterSpacing: 4, fontFamily: fonts.bodyBold }]}
                />
              </NeuInset>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <NeuCard
                gradient={gradients.black}
                onPress={lookup}
                style={{ padding: 14, alignItems: "center", marginTop: 8 }}
              >
                <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("findFriendBtn", "Find friend")}</Text>
              </NeuCard>
            </>
          ) : phase.kind === "compose" ? (
            <>
              <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {t("sendTo", "Send to")}
              </Text>

              <NeuCard gradient={gradients.black} style={s.recipientCard}>
                <View style={s.avatar}>
                  <Text style={[s.avatarLetter, { fontFamily: fonts.displayHeavy }]}>
                    {(phase.recipient.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.recipientName, { fontFamily: fonts.displayHeavy }]}>
                    {phase.recipient.name ?? t("unnamedUser", "User")}
                  </Text>
                  <Text style={[s.recipientCode, { fontFamily: fonts.bodyBold }]}>{phase.recipient.code}</Text>
                </View>
              </NeuCard>

              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("amount", "Amount").toUpperCase()} <Text style={s.optional}>· {GIFT_MIN_AMOUNT}–{GIFT_DAILY_LIMIT} pts</Text>
              </Text>
              <NeuInset style={{ marginBottom: 14 }}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={`${GIFT_MIN_AMOUNT}`}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
                />
              </NeuInset>

              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("message", "Message").toUpperCase()} <Text style={s.optional}>· {t("optional", "optional")}</Text>
              </Text>
              <NeuInset style={{ marginBottom: 12 }}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("messagePlaceholder", "For coffee tomorrow ☕")}
                  placeholderTextColor={theme.textMuted}
                  maxLength={200}
                  multiline
                  style={[s.input, { color: theme.text, height: 70, textAlignVertical: "top", paddingTop: 12, fontFamily: fonts.body }]}
                />
              </NeuInset>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <View style={s.btnRow}>
                <Pressable onPress={() => { setPhase({ kind: "lookup" }); setAmount(""); setMessage(""); setError("") }} style={{ flex: 0.4 }}>
                  <NeuCard small style={{ padding: 12, alignItems: "center" }}>
                    <Text style={{ color: theme.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{t("back", "Back")}</Text>
                  </NeuCard>
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sendGift.isPending}
                  style={{ flex: 0.6, opacity: sendGift.isPending ? 0.5 : 1 }}
                >
                  <NeuCard gradient={gradients.black} style={{ padding: 12, alignItems: "center", borderRadius: 99 }}>
                    {sendGift.isPending ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("sendGift", "Send gift")}</Text>
                    )}
                  </NeuCard>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.doneWrap}>
              <Text style={s.doneIcon}>□</Text>
              <Text style={[s.doneTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {t("giftSent", "Gift sent!")}
              </Text>
              <Text style={[s.doneSub, { color: theme.textSecondary }]}>
                {phase.sent} pts → {phase.recipientName}
              </Text>
              <Text style={[s.doneRemain, { color: theme.textSecondary }]}>
                {phase.remaining} pts {t("remainingToday", "remaining to gift today")}
              </Text>
              <NeuCard
                gradient={gradients.black}
                onPress={() => router.back()}
                style={{ padding: 14, alignItems: "center", marginTop: 24, alignSelf: "stretch" }}
              >
                <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("done", "Done")}</Text>
              </NeuCard>
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

  title: { fontSize: 34, lineHeight: 38, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },

  balanceTile: { padding: 14, marginBottom: 20, borderRadius: 30 },
  balanceLabel: { fontSize: 11, letterSpacing: 0.5 },
  balanceValue: { fontSize: 24, marginTop: 2 },
  balanceHint: { fontSize: 11, marginTop: 4 },

  label: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6 },
  optional: { fontSize: 11, fontWeight: "500", letterSpacing: 0 },
  input: { padding: 14, fontSize: 15 },
  cta: { color: colors.ink, fontSize: 15 },
  err: { color: "#DC2626", fontSize: 13, marginBottom: 8 },

  recipientCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginBottom: 20, borderRadius: 30 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.86)" },
  avatarLetter: { color: colors.ink, fontSize: 20 },
  recipientName: { color: colors.ink, fontSize: 16 },
  recipientCode: { color: "#91A1B4", fontSize: 12, marginTop: 2, letterSpacing: 2 },

  btnRow: { flexDirection: "row", gap: 8, marginTop: 8 },

  doneWrap: { alignItems: "center", paddingTop: 40 },
  doneIcon: { color: colors.ink, fontSize: 72, lineHeight: 76, fontWeight: "900", marginBottom: 12 },
  doneTitle: { fontSize: 34, lineHeight: 38 },
  doneSub: { fontSize: 14, marginTop: 8 },
  doneRemain: { fontSize: 12, marginTop: 4 },
})
