import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

export default function HomeScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const leaderboard = trpc.venue.rateLeaderboard.useQuery({ limit: 5 })

  const totalPoints = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      {/* Greeting */}
      <Text style={[s.greeting, { color: theme.text }]}>
        {t("hello", "Hi")}{me.data?.name ? `, ${me.data.name}` : ""}
      </Text>

      {/* Points hero */}
      <View style={[s.hero, { backgroundColor: colors.pink }]}>
        <Text style={s.heroLabel}>{t("pointsBalance", "Points balance")}</Text>
        <Text style={s.heroValue}>{totalPoints.toLocaleString()}</Text>
        {me.data ? (
          <Text style={s.heroSub}>
            {me.data.earnedPoints} {t("earnedPoints", "earned")} · {me.data.welcomePoints} {t("welcomePoints", "welcome")}
          </Text>
        ) : null}
      </View>

      {/* Streak card */}
      {me.data ? (
        <View style={[s.streakCard, { backgroundColor: colors.sky }]}>
          <View>
            <Text style={s.streakLabel}>🔥 {t("currentStreak", "Streak")}</Text>
            <Text style={s.streakValue}>{me.data.currentStreak} {t("days", "days")}</Text>
          </View>
          <Text style={s.streakBest}>
            {t("best", "Best")}: {me.data.longestStreak}
          </Text>
        </View>
      ) : null}

      {/* Quick actions */}
      <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
        {t("quickActions", "Quick actions").toUpperCase()}
      </Text>
      <View style={s.actions}>
        <ActionButton label={t("nav.earn", "Earn")} icon="📷" onPress={() => router.push("/earn")} theme={theme} />
        <ActionButton label={t("nav.rewards", "Rewards")} icon="🎁" onPress={() => router.push("/rewards")} theme={theme} />
        <ActionButton label={t("nav.map", "Map")} icon="🗺️" onPress={() => router.push("/map")} theme={theme} />
      </View>

      {/* Top venues by points rate */}
      <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
        {t("topRates", "Top points rate").toUpperCase()}
      </Text>
      {!leaderboard.data || leaderboard.data.length === 0 ? (
        <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {t("noVenues", "No partner venues yet")}
          </Text>
        </View>
      ) : (
        <View style={[s.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {leaderboard.data.map((v, i) => (
            <Pressable
              key={v.id}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: v.id } })}
              style={[s.row, i < leaderboard.data!.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
            >
              <View style={s.rowLeft}>
                <Text style={[s.rank, { color: theme.textSecondary }]}>{i + 1}</Text>
                <View>
                  <Text style={[s.venueName, { color: theme.text }]}>{v.name}</Text>
                  <Text style={[s.venueSub, { color: theme.textSecondary }]}>
                    {v.city} · {v.category.toLowerCase()}
                  </Text>
                </View>
              </View>
              <View style={s.rowRight}>
                <Text style={[s.rate, { color: colors.mint }]}>
                  {v.effectiveRate.toFixed(3)} pts/RSD
                </Text>
                {v.boostActive ? (
                  <Text style={s.boost}>×{v.boostMultiplier} BOOST</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

function ActionButton({
  label, icon, onPress, theme,
}: { label: string; icon: string; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.action, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={s.actionIcon}>{icon}</Text>
      <Text style={[s.actionLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  hero: { borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 12 },
  heroLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", opacity: 0.85 },
  heroValue: { color: "#FFF", fontSize: 44, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "#FFF", fontSize: 12, marginTop: 6, opacity: 0.85 },
  streakCard: { borderRadius: 14, padding: 16, marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  streakLabel: { color: "#FFF", fontSize: 12, fontWeight: "600", opacity: 0.9 },
  streakValue: { color: "#FFF", fontSize: 22, fontWeight: "700", marginTop: 2 },
  streakBest: { color: "#FFF", fontSize: 12, opacity: 0.85 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 24 },
  action: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionLabel: { fontSize: 13, fontWeight: "600" },
  empty: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  list: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rank: { width: 16, fontSize: 13, fontWeight: "700", textAlign: "center" },
  venueName: { fontSize: 14, fontWeight: "600" },
  venueSub: { fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rate: { fontSize: 13, fontWeight: "700" },
  boost: { fontSize: 10, color: colors.pink, fontWeight: "700", marginTop: 2 },
})
