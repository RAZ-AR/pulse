import { useState } from "react"
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"
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
        headerTintColor: theme.text,
      }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {phase.kind === "lookup" ? (
            <>
              <Text style={[s.title, { color: theme.text }]}>{t("findFriend", "Find your friend")}</Text>
              <Text style={[s.subtitle, { color: theme.textSecondary }]}>
                {t("giftHint", "Enter their 6-character referral code from their PULSE profile")}
              </Text>

              <View style={[s.balanceTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.balanceLabel, { color: theme.textSecondary }]}>{t("availableEarned", "Available to gift")}</Text>
                <Text style={[s.balanceValue, { color: theme.text }]}>{earnedPoints.toLocaleString()} pts</Text>
                <Text style={[s.balanceHint, { color: theme.textSecondary }]}>
                  {t("dailyLimit", "Daily limit")}: {GIFT_DAILY_LIMIT} pts
                </Text>
              </View>

              <View style={s.field}>
                <Text style={[s.label, { color: theme.textSecondary }]}>{t("referralCode", "Referral code")}</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  onSubmitEditing={lookup}
                  placeholder="ABC123"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={[s.input, { borderColor: theme.border, color: theme.text, letterSpacing: 4, fontFamily: "monospace" }]}
                />
              </View>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <Pressable
                onPress={lookup}
                style={[s.btn, { backgroundColor: theme.text }]}
              >
                <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("findFriendBtn", "Find friend")}</Text>
              </Pressable>
            </>
          ) : phase.kind === "compose" ? (
            <>
              <Text style={[s.title, { color: theme.text }]}>{t("sendTo", "Send to")}</Text>

              <View style={[s.recipientCard, { backgroundColor: colors.pink }]}>
                <View style={s.avatar}>
                  <Text style={s.avatarLetter}>{(phase.recipient.name?.[0] ?? "?").toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recipientName}>{phase.recipient.name ?? t("unnamedUser", "User")}</Text>
                  <Text style={s.recipientCode}>{phase.recipient.code}</Text>
                </View>
              </View>

              <View style={s.field}>
                <Text style={[s.label, { color: theme.textSecondary }]}>
                  {t("amount", "Amount")} <Text style={{ color: theme.textSecondary, fontSize: 11 }}>· {GIFT_MIN_AMOUNT}–{GIFT_DAILY_LIMIT} pts</Text>
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={`${GIFT_MIN_AMOUNT}`}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  style={[s.input, { borderColor: theme.border, color: theme.text }]}
                />
              </View>

              <View style={s.field}>
                <Text style={[s.label, { color: theme.textSecondary }]}>
                  {t("message", "Message")} <Text style={[s.optional, { color: theme.textSecondary }]}>· {t("optional", "optional")}</Text>
                </Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("messagePlaceholder", "For coffee tomorrow ☕")}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={200}
                  multiline
                  style={[s.input, { borderColor: theme.border, color: theme.text, height: 70, textAlignVertical: "top", paddingTop: 12 }]}
                />
              </View>

              {error ? <Text style={s.err}>{error}</Text> : null}

              <View style={s.btnRow}>
                <Pressable
                  onPress={() => { setPhase({ kind: "lookup" }); setAmount(""); setMessage(""); setError("") }}
                  style={[s.btn, s.btnGhost, { borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.text, fontWeight: "600" }}>{t("back", "Back")}</Text>
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sendGift.isPending}
                  style={[s.btn, { backgroundColor: theme.text, flex: 1, opacity: sendGift.isPending ? 0.5 : 1 }]}
                >
                  {sendGift.isPending ? (
                    <ActivityIndicator color={theme.bg} />
                  ) : (
                    <Text style={{ color: theme.bg, fontWeight: "700" }}>
                      {t("sendGift", "Send gift")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.doneWrap}>
              <Text style={s.doneEmoji}>🎁</Text>
              <Text style={[s.doneTitle, { color: theme.text }]}>{t("giftSent", "Gift sent!")}</Text>
              <Text style={[s.doneSub, { color: theme.textSecondary }]}>
                {phase.sent} pts → {phase.recipientName}
              </Text>
              <Text style={[s.doneRemain, { color: theme.textSecondary }]}>
                {phase.remaining} pts {t("remainingToday", "remaining to gift today")}
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={[s.btn, { backgroundColor: theme.text, marginTop: 24 }]}
              >
                <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("done", "Done")}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  balanceTile: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  balanceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  balanceValue: { fontSize: 24, fontWeight: "800", marginTop: 2 },
  balanceHint: { fontSize: 11, marginTop: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 4, letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15 },
  optional: { fontSize: 11, fontWeight: "500" },
  btn: { padding: 14, borderRadius: 12, alignItems: "center" },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, paddingHorizontal: 22 },
  err: { color: "#DC2626", fontSize: 13, marginBottom: 8 },
  recipientCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  recipientName: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  recipientCode: { color: "#FFF", fontSize: 12, opacity: 0.85, marginTop: 2, fontFamily: "monospace", letterSpacing: 2 },
  doneWrap: { alignItems: "center", paddingTop: 40 },
  doneEmoji: { fontSize: 72, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: "800" },
  doneSub: { fontSize: 14, marginTop: 8 },
  doneRemain: { fontSize: 12, marginTop: 4 },
})
