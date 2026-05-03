import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

const TYPE_LABELS: Record<string, string> = {
  SPEND_AMOUNT: "💸 Spend",
  VISIT_N_VENUES: "📍 Visit",
  WALK_STEPS: "👟 Steps",
  COMBO: "🎯 Combo",
  STREAK: "🔥 Streak",
}

function daysLeft(end: Date | string): number {
  const ms = new Date(end).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function ruleSummary(type: string, rules: unknown): string {
  const r = rules as { threshold?: number; count?: number; days?: number }
  if (type === "SPEND_AMOUNT") return `Spend ${r.threshold} RSD`
  if (type === "VISIT_N_VENUES") return `Visit ${r.count} venues`
  if (type === "STREAK") return `${r.days}-day streak`
  return ""
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
  const target = (c.rules as { threshold?: number; count?: number; days?: number })
  const total = target.threshold ?? target.count ?? target.days ?? 1
  const pct = uc?.isCompleted ? 100 : uc ? Math.min(100, (uc.progress / total) * 100) : 0
  const isJoined = !!uc

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: c.title,
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: uc?.isCompleted ? colors.mint : colors.pink }]}>
          <Text style={s.heroType}>{TYPE_LABELS[c.type] ?? c.type}</Text>
          <Text style={s.heroTitle}>{c.title}</Text>
          <Text style={s.heroReward}>+{c.pointsReward} pts</Text>
        </View>

        {/* Description */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.cardLabel, { color: theme.textSecondary }]}>
            {t("aboutChallenge", "About").toUpperCase()}
          </Text>
          <Text style={[s.body, { color: theme.text }]}>{c.description}</Text>
        </View>

        {/* Progress (only when joined) */}
        {isJoined && uc ? (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: uc.isCompleted ? colors.mint : theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>
              {t("progress", "Progress").toUpperCase()}
            </Text>
            <View style={s.progressBig}>
              <Text style={[s.progressNumber, { color: theme.text }]}>
                {uc.progress} <Text style={{ color: theme.textSecondary, fontSize: 18 }}>/ {total}</Text>
              </Text>
              {uc.isCompleted ? (
                <Text style={[s.completedTag, { color: colors.mint }]}>
                  ✓ {t("completed", "Completed")}
                </Text>
              ) : null}
            </View>
            <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  s.progressFill,
                  { width: `${pct}%`, backgroundColor: uc.isCompleted ? colors.mint : colors.pink },
                ]}
              />
            </View>
          </View>
        ) : null}

        {/* Stats row */}
        <View style={s.statsRow}>
          <Stat label={t("daysLeft", "Days left")} value={`${daysLeft(c.endDate)}`} theme={theme} />
          <Stat label={t("participants", "Participants")} value={`${c._count?.participants ?? 0}`} theme={theme} />
          <Stat label={t("goal", "Goal")} value={ruleSummary(c.type, c.rules)} theme={theme} small />
        </View>

        {/* Action */}
        {!isJoined ? (
          <Pressable
            onPress={() => join.mutate({ challengeId: c.id })}
            disabled={join.isPending}
            style={[s.btn, { backgroundColor: theme.text, opacity: join.isPending ? 0.5 : 1 }]}
          >
            <Text style={{ color: theme.bg, fontWeight: "700", fontSize: 15 }}>
              {join.isPending ? t("joining", "Joining…") : t("joinChallenge", "Join challenge")}
            </Text>
          </Pressable>
        ) : uc?.isCompleted ? (
          <View style={[s.completedBox, { borderColor: colors.mint }]}>
            <Text style={[s.completedTitle, { color: colors.mint }]}>
              ✓ {t("rewardClaimed", "Reward claimed")}
            </Text>
            <Text style={[s.completedSub, { color: theme.textSecondary }]}>
              +{c.pointsReward} pts {t("addedToBalance", "added to your balance")}
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontWeight: "600", fontSize: 14 }}>
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
}: { label: string; value: string; theme: ReturnType<typeof useTheme>; small?: boolean }) {
  return (
    <View style={[s.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[s.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[small ? s.statValueSmall : s.statValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { padding: 24, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  heroType: { color: "#FFF", fontSize: 12, fontWeight: "700", opacity: 0.85, letterSpacing: 0.5 },
  heroTitle: { color: "#FFF", fontSize: 24, fontWeight: "800", marginTop: 4, textAlign: "center" },
  heroReward: { color: "#FFF", fontSize: 28, fontWeight: "800", marginTop: 8 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20 },
  progressBig: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  progressNumber: { fontSize: 28, fontWeight: "800" },
  completedTag: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  stat: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1 },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statValueSmall: { fontSize: 12, fontWeight: "700" },
  btn: { padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  completedBox: { padding: 16, borderRadius: 12, borderWidth: 2, alignItems: "center", marginTop: 8 },
  completedTitle: { fontSize: 16, fontWeight: "800" },
  completedSub: { fontSize: 12, marginTop: 4 },
})
