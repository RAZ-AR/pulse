import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter, Stack } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"

const CATEGORIES = ["ALL", "CAFE", "RESTAURANT", "RETAIL", "SERVICE"] as const
type Category = (typeof CATEGORIES)[number]

export default function LeaderboardScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()
  const me = trpc.user.me.useQuery()

  const [category, setCategory] = useState<Category>("ALL")
  const [city, setCity] = useState<string | null>(null)

  const venues = trpc.venue.rateLeaderboard.useQuery({
    limit: 50,
    ...(category !== "ALL" ? { category } : {}),
    ...(city ? { city } : {}),
  })

  const cities = me.data?.homeCity ? [me.data.homeCity, "Belgrade"] : ["Belgrade"]
  const uniqueCities = Array.from(new Set(cities))

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("leaderboard", "Leaderboard"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {/* City filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <FilterChip
            label={t("allCities", "All cities")}
            active={city === null}
            onPress={() => setCity(null)}
            theme={theme}
          />
          {uniqueCities.map((c) => (
            <FilterChip key={c} label={c} active={city === c} onPress={() => setCity(c)} theme={theme} />
          ))}
        </ScrollView>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              label={cat === "ALL" ? t("allCategories", "All") : cat}
              active={category === cat}
              onPress={() => setCategory(cat)}
              theme={theme}
            />
          ))}
        </ScrollView>

        {/* Leaderboard list */}
        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {!venues.data || venues.data.length === 0 ? (
            <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>{t("noVenues", "No partner venues match these filters")}</Text>
            </View>
          ) : (
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {venues.data.map((v, i) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push({ pathname: "/venue/[id]", params: { id: v.id } })}
                  style={[s.row, i < venues.data!.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
                >
                  <View style={s.rowLeft}>
                    <View style={[s.rankBox, i < 3 && { backgroundColor: i === 0 ? colors.pink : i === 1 ? colors.sky : colors.mint }]}>
                      <Text style={[s.rank, i < 3 ? { color: "#FFF" } : { color: theme.textSecondary }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.nameRow}>
                        <Text style={[s.name, { color: theme.text }]}>{v.name}</Text>
                        {v.subscriptionTier === "FEATURED" ? (
                          <Text style={s.featuredBadge}>★ FEATURED</Text>
                        ) : null}
                      </View>
                      <Text style={[s.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                        {v.city} · {v.category.toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={[s.rate, { color: theme.text }]}>{v.effectiveRate.toFixed(3)}</Text>
                    <Text style={[s.rateUnit, { color: theme.textSecondary }]}>pts/RSD</Text>
                    {v.boostActive ? (
                      <Text style={s.boost}>×{v.boostMultiplier}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  )
}

function FilterChip({
  label, active, onPress, theme,
}: { label: string; active: boolean; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        {
          backgroundColor: active ? theme.text : "transparent",
          borderColor: active ? theme.text : theme.border,
        },
      ]}
    >
      <Text style={{ color: active ? theme.bg : theme.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  empty: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rankBox: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  rank: { fontSize: 13, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "600" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  featuredBadge: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, color: "#FFF", backgroundColor: "#FF4D8F", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  sub: { fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rate: { fontSize: 16, fontWeight: "800" },
  rateUnit: { fontSize: 10, fontWeight: "600" },
  boost: { fontSize: 10, fontWeight: "700", color: colors.pink, marginTop: 2 },
})
