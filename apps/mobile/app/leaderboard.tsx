import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../src/lib/trpc"
import { fonts, gradients, useTheme, type Theme } from "../src/lib/theme"
import { NeuCard, GradPill } from "../src/components/neu"

const CATEGORIES = ["ALL", "CAFE", "RESTAURANT", "RETAIL", "SERVICE"] as const
type Category = (typeof CATEGORIES)[number]
type MainTab = "venues" | "players"

const PODIUM_GRADS = [gradients.gold, ["#E8E8E8", "#C0C0C0"] as const, ["#F5C7A0", "#CD7F32"] as const]

export default function LeaderboardScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()
  const me = trpc.user.me.useQuery()

  const [mainTab, setMainTab] = useState<MainTab>("venues")
  const [category, setCategory] = useState<Category>("ALL")
  const [city, setCity] = useState<string | null>(null)
  const [playerScope, setPlayerScope] = useState<"city" | "global">("city")

  const venues = trpc.venue.rateLeaderboard.useQuery({
    limit: 50,
    ...(category !== "ALL" ? { category } : {}),
    ...(city ? { city } : {}),
  })

  const myCity = me.data?.homeCity ?? null
  const playersCity = trpc.leaderboard.city.useQuery(
    { city: myCity ?? "Belgrade", limit: 50 },
    { enabled: mainTab === "players" && playerScope === "city" },
  )
  const playersGlobal = trpc.leaderboard.global.useQuery(
    { limit: 50 },
    { enabled: mainTab === "players" && playerScope === "global" },
  )
  const myRank = trpc.leaderboard.myRank.useQuery(undefined, { enabled: mainTab === "players" })

  const cities = myCity ? [myCity, "Belgrade"] : ["Belgrade"]
  const uniqueCities = Array.from(new Set(cities))

  const playerEntries = playerScope === "city"
    ? (playersCity.data?.entries ?? [])
    : (playersGlobal.data?.entries ?? [])

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("leaderboard", "Leaderboard"),
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {/* Main tabs */}
        <View style={s.mainTabs}>
          <MainTabBtn label={t("venues", "Venues")} active={mainTab === "venues"} onPress={() => setMainTab("venues")} theme={theme} />
          <MainTabBtn label={t("players", "Players")} active={mainTab === "players"} onPress={() => setMainTab("players")} theme={theme} />
        </View>

        {mainTab === "venues" ? (
          <>
            {/* City filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
              <Chip label={t("allCities", "All cities")} active={city === null} onPress={() => setCity(null)} theme={theme} />
              {uniqueCities.map((c) => (
                <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} theme={theme} />
              ))}
            </ScrollView>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat === "ALL" ? t("allCategories", "All") : cat}
                  active={category === cat}
                  onPress={() => setCategory(cat)}
                  theme={theme}
                />
              ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
              {!venues.data || venues.data.length === 0 ? (
                <NeuCard style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: theme.textSecondary }}>
                    {t("noVenues", "No partner venues match these filters")}
                  </Text>
                </NeuCard>
              ) : (
                <NeuCard style={{ padding: 0 }}>
                  {venues.data.map((v, i) => (
                    <Pressable
                      key={v.id}
                      onPress={() => router.push({ pathname: "/venue/[id]", params: { id: v.id } })}
                      style={[
                        s.row,
                        i < venues.data!.length - 1 && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 },
                      ]}
                    >
                      <RankBadge rank={i + 1} theme={theme} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={s.nameRow}>
                          <Text style={[s.name, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                            {v.name}
                          </Text>
                          {v.subscriptionTier === "FEATURED" ? (
                            <GradPill label="★ FEATURED" gradient={gradients.pink} />
                          ) : null}
                        </View>
                        <Text style={[s.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                          {v.city} · {v.category.toLowerCase()}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.rate, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                          {v.effectiveRate.toFixed(3)}
                        </Text>
                        <Text style={[s.rateUnit, { color: theme.textSecondary }]}>pts/RSD</Text>
                        {v.boostActive ? (
                          <Text style={[s.boost, { fontFamily: fonts.bodyBold }]}>×{v.boostMultiplier}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </NeuCard>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            {/* City / Global scope */}
            <View style={s.scopeRow}>
              <Chip
                label={myCity ?? "My city"}
                active={playerScope === "city"}
                onPress={() => setPlayerScope("city")}
                theme={theme}
              />
              <Chip
                label={t("global", "Global")}
                active={playerScope === "global"}
                onPress={() => setPlayerScope("global")}
                theme={theme}
              />
            </View>

            {/* My rank banner */}
            {myRank.data?.cityRank ? (
              <NeuCard gradient={gradients.rainbow} style={s.myRankBanner}>
                <View style={s.myRankBannerBlob} />
                <View>
                  <Text style={[s.myRankLabel, { fontFamily: fonts.bodyBold }]}>
                    {t("yourRank", "Your rank").toUpperCase()}
                  </Text>
                  <Text style={[s.myRankValue, { fontFamily: fonts.displayHeavy }]}>
                    #{playerScope === "city" ? myRank.data.cityRank : myRank.data.globalRank}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.myRankPts}>{myRank.data.totalPoints.toLocaleString()}</Text>
                  <Text style={s.myRankPtsLabel}>pts</Text>
                </View>
              </NeuCard>
            ) : null}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
              {playerEntries.length === 0 ? (
                <NeuCard style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: theme.textSecondary }}>
                    {t("noPlayers", "No players yet")}
                  </Text>
                </NeuCard>
              ) : (
                <NeuCard style={{ padding: 0 }}>
                  {playerEntries.map((entry, i) => {
                    const isMe = entry.userId === me.data?.id
                    return (
                      <View
                        key={entry.userId}
                        style={[
                          s.row,
                          isMe && { backgroundColor: "rgba(163,160,200,0.08)" },
                          i < playerEntries.length - 1 && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 },
                        ]}
                      >
                        <RankBadge rank={entry.rank} theme={theme} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={s.nameRow}>
                            <Text style={[s.name, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                              {entry.name}
                            </Text>
                            {isMe ? <GradPill label="you" gradient={gradients.blue} /> : null}
                          </View>
                          <Text style={[s.sub, { color: theme.textSecondary }]}>
                            🔥 {entry.currentStreak}d streak
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.rate, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                            {entry.totalPoints.toLocaleString()}
                          </Text>
                          <Text style={[s.rateUnit, { color: theme.textSecondary }]}>pts</Text>
                        </View>
                      </View>
                    )
                  })}
                </NeuCard>
              )}
            </ScrollView>
          </>
        )}
      </View>
    </>
  )
}

function MainTabBtn({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: Theme }) {
  return (
    <Pressable onPress={onPress} style={s.mainTab}>
      <Text style={[
        s.mainTabLabel,
        { color: active ? theme.text : theme.textSecondary, fontFamily: active ? fonts.bodyBold : fonts.body },
      ]}>
        {label}
      </Text>
      {active ? <View style={[s.mainTabIndicator, theme.shadowGlow]} /> : null}
    </Pressable>
  )
}

function RankBadge({ rank, theme }: { rank: number; theme: Theme }) {
  if (rank <= 3) {
    const grad = PODIUM_GRADS[rank - 1]!
    return (
      <LinearGradient
        colors={grad as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.rankBox, theme.shadowRaisedSm]}
      >
        <Text style={[s.rankText, { color: "#FFF", fontFamily: fonts.displayHeavy }]}>{rank}</Text>
      </LinearGradient>
    )
  }
  return (
    <View style={[s.rankBox, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}>
      <Text style={[s.rankText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>{rank}</Text>
    </View>
  )
}

function Chip({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: Theme }) {
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={gradients.rainbow as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.chip, theme.shadowGlow]}
        >
          <Text style={[s.chipActive, { fontFamily: fonts.bodyBold }]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    )
  }
  return (
    <Pressable onPress={onPress} style={[s.chip, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}>
      <Text style={[s.chipText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  mainTabs: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 4, gap: 24 },
  mainTab: { paddingVertical: 12, position: "relative" },
  mainTabLabel: { fontSize: 15 },
  mainTabIndicator: {
    position: "absolute", bottom: -1, left: 0, right: 0, height: 3, borderRadius: 2,
    backgroundColor: "#FFB3E6",
  },
  filters: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  scopeRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  chipText: { fontSize: 12 },
  chipActive: { color: "#FFF", fontSize: 12, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  myRankBanner: { marginHorizontal: 16, marginBottom: 4, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", overflow: "hidden" },
  myRankBannerBlob: { position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.1)" },
  myRankLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, letterSpacing: 1 },
  myRankValue: { color: "#FFF", fontSize: 28 },
  myRankPts: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  myRankPtsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },

  list: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },

  rankBox: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 13 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 14 },
  sub: { fontSize: 11, marginTop: 2 },

  rate: { fontSize: 16 },
  rateUnit: { fontSize: 10 },
  boost: { fontSize: 10, color: "#FF85D2", marginTop: 2 },
})
