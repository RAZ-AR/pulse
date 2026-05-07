import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, gradients, useTheme, type Theme } from "../../src/lib/theme"
import { NeuCard } from "../../src/components/neu"

const TYPE_ICON: Record<string, string> = {
  SPEND_AMOUNT: "□",
  VISIT_N_VENUES: "⌖",
  WALK_STEPS: "◦",
  COMBO: "✦",
  STREAK: "✓",
}

function daysLeft(end: Date | string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000))
}

function ruleSummary(type: string, rules: unknown): string {
  const r = rules as { threshold?: number; count?: number; days?: number }
  if (type === "SPEND_AMOUNT") return `${r.threshold} RSD`
  if (type === "VISIT_N_VENUES") return `${r.count} venues`
  if (type === "STREAK") return `${r.days} days`
  return "—"
}

export default function ChallengeDetailScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { id } = useLocalSearchParams<{ id: string }>()

  const detail = trpc.challenge.detail.useQuery({ challengeId: id })
  const progress = trpc.challenge.progress.useQuery({ challengeId: id })
  const join = trpc.challenge.join.useMutation({
    onSuccess: () => {
      utils.challenge.listMine.invalidate()
      utils.challenge.listAvailable.invalidate()
      utils.challenge.progress.invalidate({ challengeId: id })
    },
    onError: (e) => Alert.alert(t("joinFailed", "Couldn't join"), e.message),
  })

  if (detail.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary }}>{t("loading", "Loading…")}</Text>
      </View>
    )
  }
  const c = detail.data
  if (!c) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("notFound", "Challenge not found")}</Text>
      </View>
    )
  }

  const uc = progress.data
  const target = c.rules as { threshold?: number; count?: number; days?: number }
  const total = target.threshold ?? target.count ?? target.days ?? 1
  const pct = uc?.isCompleted ? 100 : uc ? Math.min(100, (uc.progress / total) * 100) : 0
  const isJoined = !!uc
  const heroGrad = uc?.isCompleted ? gradients.aqua : gradients.black

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: c.title,
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <NeuCard gradient={heroGrad} style={s.hero}>
          <View style={s.heroBlob} />
          <Text style={s.heroIcon}>{TYPE_ICON[c.type] ?? "✦"}</Text>
          <Text style={[s.heroTitle, { fontFamily: fonts.displayHeavy }]} numberOfLines={2}>{c.title}</Text>
          <Text style={[s.heroReward, { fontFamily: fonts.displayHeavy }]}>+{c.pointsReward} pts</Text>
        </NeuCard>

        {/* Description */}
        <NeuCard style={s.card}>
          <Text style={[s.cardLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
            {t("aboutChallenge", "About").toUpperCase()}
          </Text>
          <Text style={[s.body, { color: theme.text }]}>{c.description}</Text>
        </NeuCard>

        {/* Progress */}
        {isJoined && uc ? (
          <NeuCard style={s.card}>
            <Text style={[s.cardLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
              {t("progress", "Progress").toUpperCase()}
            </Text>
            <View style={s.progressBig}>
              <Text style={[s.progressNumber, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {uc.progress}
                <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: "500" }}> / {total}</Text>
              </Text>
              {uc.isCompleted ? (
                <Text style={[s.completedTag, { color: "#5FEFC0", fontFamily: fonts.bodyBold }]}>
                  {t("completed", "Completed")}
                </Text>
              ) : null}
            </View>
            <View style={s.progressTrack}>
              <LinearGradient
                colors={(uc.isCompleted ? gradients.aqua : gradients.black) as unknown as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.progressFill, { width: `${pct}%` }]}
              />
            </View>
          </NeuCard>
        ) : null}

        {/* Stats */}
        <View style={s.statsRow}>
          <Stat label={t("daysLeft", "Days left")} value={`${daysLeft(c.endDate)}`} theme={theme} />
          <Stat label={t("participants", "Participants")} value={`${c._count?.participants ?? 0}`} theme={theme} />
          <Stat label={t("goal", "Goal")} value={ruleSummary(c.type, c.rules)} theme={theme} small />
        </View>

        {/* Action */}
        {!isJoined ? (
          <NeuCard
            gradient={gradients.black}
            onPress={() => join.mutate({ challengeId: c.id })}
            disabled={join.isPending}
            style={{ padding: 16, alignItems: "center" }}
          >
            <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>
              {join.isPending ? t("joining", "Joining…") : t("joinChallenge", "Join challenge")}
            </Text>
          </NeuCard>
        ) : uc?.isCompleted ? (
          <NeuCard gradient={gradients.black} style={{ padding: 18, alignItems: "center", borderRadius: 30 }}>
            <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>✓ {t("rewardClaimed", "Reward claimed")}</Text>
            <Text style={s.completedSub}>+{c.pointsReward} pts {t("addedToBalance", "added to your balance")}</Text>
          </NeuCard>
        ) : (
          <Pressable
            onPress={() => router.back()}
            style={[s.encourageCard, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}
          >
            <Text style={{ color: theme.textSecondary, fontFamily: fonts.bodyBold, fontSize: 13 }}>
              {t("keepGoing", "Keep earning to complete this")}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  )
}

function Stat({
  label, value, theme, small,
}: { label: string; value: string; theme: Theme; small?: boolean }) {
  return (
    <NeuCard small style={s.stat}>
      <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>{label.toUpperCase()}</Text>
      <Text
        style={[
          small ? s.statValueSmall : s.statValue,
          { color: theme.text, fontFamily: fonts.displayHeavy },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </NeuCard>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: { padding: 22, alignItems: "center", marginBottom: 16, overflow: "hidden", borderRadius: 32 },
  heroBlob: { position: "absolute", top: -42, right: -42, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  heroIcon: { color: "#FFF", fontSize: 48, lineHeight: 52, fontWeight: "900", marginBottom: 8 },
  heroTitle: { color: "#FFF", fontSize: 28, lineHeight: 31, textAlign: "center" },
  heroReward: { color: "#FFF", fontSize: 28, marginTop: 12 },

  card: { padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20 },

  progressBig: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  progressNumber: { fontSize: 28 },
  completedTag: { fontSize: 13, color: colors.ink },
  progressTrack: { height: 8, backgroundColor: "rgba(163,160,200,0.2)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  statsRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  stat: { flex: 1, padding: 12 },
  statLabel: { fontSize: 9, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 18 },
  statValueSmall: { fontSize: 12 },

  cta: { color: "#FFF", fontSize: 16 },
  completedSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 },
  encourageCard: { padding: 16, borderRadius: 99, alignItems: "center", marginTop: 4 },
})
