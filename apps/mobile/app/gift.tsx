import { useState } from "react"
import {
  ActivityIndicator,
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
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, gradients, neonColors, useTheme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { LavaLampSurface, NeuCard, NeuInset, VolumeGradient } from "../src/components/neu"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT } from "@pulse/shared"

const PRESETS = [100, 250, 500]

type DoneData = { shareUrl: string; shareText: string; amount: number }

export default function GiftScreen() {
  const theme = useTheme()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const router = useRouter()
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
      setError(`Минимум ${GIFT_MIN_AMOUNT} баллов`)
      return
    }
    if (n > earnedPoints) {
      setError("Не хватает накопленных баллов")
      return
    }
    if (n > remainingDailyLimit) {
      setError(`Лимит сегодня: ${remainingDailyLimit} баллов`)
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
      <Stack.Screen options={{
        headerShown: true,
        title: "Подарить баллы",
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Balance hero */}
          <LavaLampSurface style={s.hero} contentStyle={s.heroContent} intensity="glass">
            <View style={s.heroTop}>
              <View>
                <Text style={[s.kicker, { color: isRainbow ? "#1A1A2E" : theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                  ДОСТУПНО ДЛЯ ПОДАРКА
                </Text>
                <Text style={[s.heroValue, { color: isRainbow ? "#1A1A2E" : theme.text, fontFamily: fonts.displayHeavy }]}>
                  {maxGiftNow.toLocaleString()} pts
                </Text>
              </View>
              <View style={s.limitOrb}>
                <Text style={[s.limitOrbValue, { fontFamily: fonts.displayHeavy }]}>{remainingDailyLimit}</Text>
                <Text style={[s.limitOrbLabel, { fontFamily: fonts.bodyBold }]}>осталось</Text>
              </View>
            </View>
            <View style={s.limitTrack}>
              <View style={[s.limitFill, { width: `${progress * 100}%`, backgroundColor: isRainbow ? neonColors.cyan : "rgba(241,153,227,0.58)" }]} />
            </View>
            <View style={s.heroMeta}>
              <Text style={[s.metaText, { color: isRainbow ? "#1A1A2E" : theme.textSecondary }]}>{sentToday} pts отправлено сегодня</Text>
              <Text style={[s.metaText, { color: isRainbow ? "#1A1A2E" : theme.textSecondary }]}>{GIFT_DAILY_LIMIT} pts лимит</Text>
            </View>
          </LavaLampSurface>

          {done ? (
            // ── Done state ────────────────────────────────────────
            <View style={s.doneWrap}>
              <LavaLampSurface style={s.doneOrb} contentStyle={s.doneOrbInner} intensity="glass">
                <Text style={{ fontSize: 52 }}>🎁</Text>
              </LavaLampSurface>
              <Text style={[s.doneTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Ссылка создана!</Text>
              <Text style={[s.doneSub, { color: theme.textSecondary }]}>
                {done.amount} баллов — ссылка открыта в шеринге
              </Text>
              <Text style={[s.doneHint, { color: theme.textSecondary }]}>
                Баллы зачислятся, когда друг откроет ссылку
              </Text>

              <View style={s.btnRow}>
                <Pressable onPress={shareAgain} style={{ flex: 1 }}>
                  {isRainbow ? (
                    <VolumeGradient colors={["#8B3DFF", "#2B6EFF"]} shadowColor="#8B3DFF" shadowOpacity={0.30} borderRadius={99} style={s.primaryBtn}>
                      <Text style={[s.ctaText, { color: "#FFF", fontFamily: fonts.displayHeavy }]}>Поделиться снова</Text>
                    </VolumeGradient>
                  ) : (
                    <NeuCard gradient={gradients.pinkBlue} style={s.primaryBtn}>
                      <Text style={[s.ctaText, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Поделиться снова</Text>
                    </NeuCard>
                  )}
                </Pressable>
              </View>
              <Pressable onPress={reset} style={s.secondaryPressable}>
                <Text style={[s.secondaryText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>Отправить ещё</Text>
              </Pressable>
            </View>
          ) : (
            // ── Compose state ─────────────────────────────────────
            <>
              <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Сколько подарить?</Text>

              {/* Preset chips */}
              <View style={s.presetRow}>
                {PRESETS.map((value) => {
                  const selected = amount === String(value)
                  const disabled = value > maxGiftNow
                  if (selected && isRainbow) {
                    return (
                      <VolumeGradient
                        key={value}
                        colors={["#8B3DFF", "#2B6EFF"]}
                        shadowColor="#8B3DFF"
                        shadowOpacity={0.30}
                        borderRadius={18}
                        onPress={() => !disabled && selectPreset(value)}
                        style={[s.preset, { flex: 1, opacity: disabled ? 0.35 : 1 }]}
                      >
                        <Text style={[s.presetText, { color: "#FFF", fontFamily: fonts.bodyBold }]}>{value}</Text>
                      </VolumeGradient>
                    )
                  }
                  return (
                    <Pressable key={value} onPress={() => !disabled && selectPreset(value)} style={{ flex: 1, opacity: disabled ? 0.35 : 1 }}>
                      <NeuCard small gradient={selected ? gradients.pinkBlue : gradients.pearl} style={s.preset}>
                        <Text style={[s.presetText, { color: selected ? colors.ink : theme.textSecondary, fontFamily: fonts.bodyBold }]}>{value}</Text>
                      </NeuCard>
                    </Pressable>
                  )
                })}
              </View>

              {/* Custom amount input */}
              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                СВОЁ КОЛИЧЕСТВО
              </Text>
              <NeuInset style={s.inputWrap}>
                <TextInput
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v.replace(/[^0-9]/g, ""))
                    setError("")
                  }}
                  placeholder={`от ${GIFT_MIN_AMOUNT}`}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  style={[s.input, { color: theme.text, fontFamily: fonts.displayHeavy }]}
                />
              </NeuInset>

              {/* Optional message */}
              <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                СООБЩЕНИЕ <Text style={s.optional}>· необязательно</Text>
              </Text>
              <NeuInset style={s.messageWrap}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="На кофе завтра ☕"
                  placeholderTextColor={theme.textMuted}
                  maxLength={200}
                  multiline
                  style={[s.messageInput, { color: theme.text, fontFamily: fonts.body }]}
                />
              </NeuInset>

              {error ? <Text style={s.err}>{error}</Text> : null}

              {/* Main CTA */}
              <Pressable
                onPress={send}
                disabled={createLink.isPending || !canSend}
                style={{ opacity: createLink.isPending || !canSend ? 0.5 : 1 }}
              >
                {isRainbow ? (
                  <VolumeGradient colors={["#8B3DFF", "#2B6EFF"]} shadowColor="#8B3DFF" shadowOpacity={0.30} borderRadius={99} style={s.mainCta}>
                    {createLink.isPending ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={[s.ctaText, { color: "#FFF", fontFamily: fonts.displayHeavy }]}>🎁  Подарить</Text>
                    )}
                  </VolumeGradient>
                ) : (
                  <NeuCard gradient={gradients.pinkBlue} style={s.mainCta}>
                    {createLink.isPending ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={[s.ctaText, { color: theme.text, fontFamily: fonts.displayHeavy }]}>🎁  Подарить</Text>
                    )}
                  </NeuCard>
                )}
              </Pressable>

              <Text style={[s.hint, { color: theme.textSecondary }]}>
                Откроется Telegram, WhatsApp или другой способ отправки
              </Text>
            </>
          )}

          {/* ── История отправленных подарков ── */}
          {(history.data?.length ?? 0) > 0 ? (
            <>
              <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy, marginTop: 28 }]}>История</Text>
              <View style={s.historyList}>
                {history.data!.map((link) => {
                  const claimed = link.status === "CLAIMED"
                  const expired = link.status === "EXPIRED"
                  return (
                    <View key={link.id} style={[s.historyRow, { backgroundColor: isRainbow ? "#F2F2F6" : "#F9FBFF" }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.historyAmount, { color: claimed ? (isRainbow ? neonColors.green : colors.mint) : theme.text, fontFamily: fonts.displayHeavy }]}>
                          {link.amount} pts
                        </Text>
                        {link.recipient ? (
                          <Text style={[s.historyMeta, { color: theme.textSecondary }]}>
                            → {link.recipient.name ?? "пользователь"}
                          </Text>
                        ) : null}
                        {link.message ? (
                          <Text style={[s.historyMeta, { color: theme.textSecondary }]} numberOfLines={1}>{link.message}</Text>
                        ) : null}
                      </View>
                      <View style={[s.historyStatus, {
                        backgroundColor: claimed
                          ? (isRainbow ? "rgba(57,255,20,0.12)" : "rgba(178,255,200,0.4)")
                          : expired
                          ? "rgba(163,160,200,0.18)"
                          : (isRainbow ? "rgba(43,110,255,0.10)" : "rgba(235,254,255,0.8)"),
                      }]}>
                        <Text style={[s.historyStatusText, {
                          color: claimed
                            ? (isRainbow ? neonColors.green : "#5EC67A")
                            : expired
                            ? theme.textSecondary
                            : (isRainbow ? neonColors.cyan : "#7FAFC2"),
                          fontFamily: fonts.bodyBold,
                        }]}>
                          {claimed ? "получен" : expired ? "истёк" : "ждёт"}
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

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 60 },

  hero: { borderRadius: 36, marginBottom: 22 },
  heroContent: { padding: 18 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  kicker: { fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 34, lineHeight: 38 },
  limitOrb: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#A3B1C6", shadowOpacity: 0.26, shadowRadius: 14, shadowOffset: { width: 6, height: 8 },
  },
  limitOrbValue: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  limitOrbLabel: { color: "#91A1B4", fontSize: 10, textTransform: "uppercase" },
  limitTrack: { height: 18, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.6)", marginTop: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  limitFill: { height: "100%", borderRadius: 99 },
  heroMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaText: { fontSize: 11 },

  sectionTitle: { fontSize: 28, lineHeight: 32, marginBottom: 16 },

  presetRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  preset: { paddingVertical: 12, alignItems: "center", borderRadius: 18 },
  presetText: { fontSize: 16 },

  label: { fontSize: 11, letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: "500", letterSpacing: 0 },
  inputWrap: { marginBottom: 16, borderRadius: 24 },
  input: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 28, lineHeight: 34 },
  messageWrap: { marginBottom: 14, borderRadius: 24 },
  messageInput: { padding: 16, fontSize: 15, minHeight: 86, textAlignVertical: "top" },

  err: { color: "#DC2626", fontSize: 13, marginBottom: 10 },
  mainCta: { padding: 16, alignItems: "center", borderRadius: 99, marginBottom: 12 },
  ctaText: { fontSize: 16 },
  hint: { fontSize: 12, textAlign: "center", lineHeight: 18 },

  doneWrap: { alignItems: "center", paddingTop: 20 },
  doneOrb: { width: 142, height: 142, borderRadius: 71, marginBottom: 18 },
  doneOrbInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 34, lineHeight: 38 },
  doneSub: { fontSize: 15, marginTop: 8, textAlign: "center" },
  doneHint: { fontSize: 12, marginTop: 6, marginBottom: 22, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 12 },
  primaryBtn: { padding: 14, alignItems: "center", borderRadius: 99 },
  secondaryPressable: { padding: 12, alignItems: "center" },
  secondaryText: { fontSize: 14 },

  historyList: { gap: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 24, gap: 10 },
  historyAmount: { fontSize: 18 },
  historyMeta: { fontSize: 12, marginTop: 2 },
  historyStatus: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  historyStatusText: { fontSize: 11 },
})
