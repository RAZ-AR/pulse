import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../../src/lib/trpc"
import { fonts, gradients, useTheme } from "../../src/lib/theme"
import { NeuCard } from "../../src/components/neu"

const VENUE_GRADIENTS = [gradients.rainbow, gradients.rainbow2, gradients.rainbow4] as const

function fmt(n: number) {
  return n.toLocaleString()
}

function daysLeft(d: Date | string | null | undefined): number {
  if (!d) return 0
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000))
}

export default function HomeScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const leaderboard = trpc.venue.rateLeaderboard.useQuery({ limit: 6 })
  const myChallenges = trpc.challenge.listMine.useQuery()
  const activeChallenges = (myChallenges.data ?? []).filter((uc) => !uc.isCompleted).slice(0, 2)

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.greeting, { color: theme.textSecondary, fontFamily: fonts.body }]}>
            {t("goodMorning", "Good morning 👋")}
          </Text>
          <Text style={[s.userName, { color: theme.text, fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
            {me.data?.name ?? "—"}
          </Text>
        </View>
        <LinearGradient
          colors={gradients.rainbow as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.avatar, theme.shadowRaisedSm]}
        >
          <Text style={s.avatarLetter}>{(me.data?.name?.[0] ?? "?").toUpperCase()}</Text>
        </LinearGradient>
      </View>

      {/* Points hero */}
      <NeuCard gradient={gradients.rainbow} style={{ padding: 24, marginBottom: 16 }}>
        <View style={[s.heroBlob, { top: -30, right: -30, width: 120, height: 120 }]} />
        <View style={[s.heroBlob, { bottom: -20, left: 20, width: 80, height: 80, opacity: 0.6 }]} />
        <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>
          {t("pointsBalance", "Total balance").toUpperCase()}
        </Text>
        <View style={s.heroValueRow}>
          <Text style={[s.heroValue, { fontFamily: fonts.displayHeavy }]}>{fmt(total)}</Text>
          <Text style={[s.heroValueUnit, { fontFamily: fonts.body }]}> pts</Text>
        </View>
        <View style={s.heroStats}>
          <HeroStat label={t("earned", "Earned")} value={fmt(me.data?.earnedPoints ?? 0)} />
          <HeroStat label={`${t("welcome", "Welcome")} 🎁`} value={fmt(me.data?.welcomePoints ?? 0)} />
          <HeroStat label={t("expires", "Expires")} value={`${welcomeDays}d`} />
        </View>
      </NeuCard>

      {/* Streak + quick actions */}
      <View style={s.row}>
        <NeuCard style={s.streakCard}>
          <Text style={s.streakIcon}>🔥</Text>
          <View>
            <Text style={[s.streakValue, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
              {me.data?.currentStreak ?? 0}
            </Text>
            <Text style={[s.streakLabel, { color: theme.textSecondary, fontFamily: fonts.body }]}>
              {t("dayStreak", "day streak")}
            </Text>
          </View>
        </NeuCard>

        <View style={s.quickCol}>
          <NeuCard gradient={gradients.pink} style={s.quickAction} onPress={() => router.push("/earn")}>
            <Text style={[s.quickLabel, { fontFamily: fonts.bodyBold }]}>📷  {t("scan", "Scan")}</Text>
            <Text style={s.quickArrow}>→</Text>
          </NeuCard>
          <NeuCard gradient={gradients.blue} style={s.quickAction} onPress={() => router.push("/rewards")}>
            <Text style={[s.quickLabel, { fontFamily: fonts.bodyBold }]}>🎁  {t("nav.rewards", "Rewards")}</Text>
            <Text style={s.quickArrow}>→</Text>
          </NeuCard>
        </View>
      </View>

      {/* Active challenges */}
      {activeChallenges.length > 0 ? (
        <>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
              {t("activeChallenges", "Your quests")}
            </Text>
            <Pressable onPress={() => router.push("/challenges")}>
              <Text style={[s.seeAll, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("seeAll", "See all →")}
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {activeChallenges.map((uc) => {
              const target = uc.challenge.rules as { threshold?: number; count?: number; days?: number }
              const total = target.threshold ?? target.count ?? target.days ?? 1
              const pct = Math.min(100, (uc.progress / total) * 100)
              return (
                <NeuCard
                  key={uc.id}
                  gradient={gradients.rainbow2}
                  style={{ padding: 14 }}
                  onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: uc.challengeId } })}
                >
                  <View style={s.challengeHead}>
                    <Text style={[s.challengeTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                      {uc.challenge.title}
                    </Text>
                    <Text style={[s.challengeReward, { fontFamily: fonts.displayHeavy }]}>
                      +{uc.challenge.pointsReward}
                    </Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={[s.progressText, { fontFamily: fonts.bodyBold }]}>
                    {uc.progress}/{total}
                  </Text>
                </NeuCard>
              )
            })}
          </View>
        </>
      ) : null}

      {/* Top venues */}
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
          {t("topRates", "Top points rate")}
        </Text>
        <Pressable onPress={() => router.push("/leaderboard")}>
          <Text style={[s.seeAll, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
            {t("seeAll", "See all →")}
          </Text>
        </Pressable>
      </View>

      <View style={s.venueGrid}>
        {(leaderboard.data ?? []).slice(0, 6).map((v, i) => {
          const grad = VENUE_GRADIENTS[i % VENUE_GRADIENTS.length]!
          const rate = v.effectiveRate
          return (
            <NeuCard
              key={v.id}
              gradient={grad}
              style={s.venueCard}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: v.id } })}
            >
              <View style={[s.venueBlob]} />
              <Text style={[s.venueName, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{v.name}</Text>
              <Text style={s.venueCity} numberOfLines={1}>{v.city}</Text>
              <Text style={[s.venueRate, { fontFamily: fonts.displayHeavy }]}>{rate.toFixed(3)}</Text>
              <Text style={s.venueRateUnit}>pts/RSD</Text>
              {v.boostActive ? (
                <View style={s.boostPill}>
                  <Text style={[s.boostText, { fontFamily: fonts.bodyBold }]}>×{v.boostMultiplier} BOOST</Text>
                </View>
              ) : null}
            </NeuCard>
          )
        })}
      </View>
    </ScrollView>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.heroStat}>
      <Text style={s.heroStatLabel}>{label}</Text>
      <Text style={[s.heroStatValue, { fontFamily: fonts.bodyBold }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  greeting: { fontSize: 12 },
  userName: { fontSize: 24 },
  avatar: {
    width: 46, height: 46, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { color: "#FFF", fontSize: 18, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.15)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Hero
  heroBlob: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  heroLabel: { color: "rgba(255,255,255,0.78)", fontSize: 11, letterSpacing: 1.5 },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4, marginBottom: 14 },
  heroValue: { color: "#FFF", fontSize: 54, lineHeight: 56, textShadowColor: "rgba(0,0,0,0.12)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  heroValueUnit: { color: "rgba(255,255,255,0.7)", fontSize: 18 },
  heroStats: { flexDirection: "row", gap: 8 },
  heroStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12, padding: 8 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: 0.8, fontWeight: "700", textTransform: "uppercase" },
  heroStatValue: { color: "#FFF", fontSize: 15, marginTop: 2 },

  // Streak + quick
  row: { flexDirection: "row", gap: 12, marginBottom: 24 },
  streakCard: { flex: 1, padding: 14, justifyContent: "space-between", minHeight: 110 },
  streakIcon: { fontSize: 28 },
  streakValue: { fontSize: 28, lineHeight: 30 },
  streakLabel: { fontSize: 11, marginTop: 2 },
  quickCol: { flex: 2, gap: 10 },
  quickAction: { padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickLabel: { color: "#FFF", fontSize: 14, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  quickArrow: { color: "rgba(255,255,255,0.7)", fontSize: 16 },

  // Sections
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18 },
  seeAll: { fontSize: 12 },

  // Challenges
  challengeHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  challengeTitle: { color: "#FFF", fontSize: 14, flex: 1, marginRight: 10, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  challengeReward: { color: "#FFF", fontSize: 15 },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3, marginBottom: 6, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 3 },
  progressText: { color: "#FFF", fontSize: 11, alignSelf: "flex-end" },

  // Venues
  venueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  venueCard: { width: "48%", padding: 16, minHeight: 140, overflow: "hidden" },
  venueBlob: { position: "absolute", top: -16, right: -16, width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.15)" },
  venueName: { color: "#FFF", fontSize: 13, marginBottom: 2, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  venueCity: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 12 },
  venueRate: { color: "#FFF", fontSize: 22, lineHeight: 24, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  venueRateUnit: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "700" },
  boostPill: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  boostText: { color: "#FFF", fontSize: 9 },
})
