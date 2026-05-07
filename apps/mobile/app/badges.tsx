import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"
import { LavaLampSurface } from "../src/components/neu"

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#9CA3AF",
  RARE: colors.sky,
  EPIC: colors.ink,
  LEGENDARY: "#F59E0B",
}

export default function BadgesScreen() {
  const theme = useTheme()
  const { t } = useTranslation("profile")

  const all = trpc.badge.list.useQuery()
  const mine = trpc.badge.mine.useQuery()

  const unlockedIds = new Set((mine.data ?? []).map((b) => b.id))
  const allBadges = all.data ?? []
  const unlockedCount = unlockedIds.size
  const totalCount = allBadges.length

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("badges", "Badges"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Progress hero */}
        <LavaLampSurface style={s.hero}>
          <Text style={s.heroLabel}>{t("badgesUnlocked", "BADGES UNLOCKED")}</Text>
          <Text style={s.heroValue}>{unlockedCount} <Text style={s.heroDenom}>/ {totalCount}</Text></Text>
          {totalCount > 0 ? (
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(unlockedCount / totalCount) * 100}%` }]} />
            </View>
          ) : null}
        </LavaLampSurface>

        {/* Grid */}
        <View style={s.grid}>
          {allBadges.map((badge) => {
            const unlocked = unlockedIds.has(badge.id)
            const rarityColor = RARITY_COLORS[badge.rarity] ?? colors.sky
            return (
              <View
                key={badge.id}
                style={[
                  s.card,
                  {
                    backgroundColor: theme.surface,
                    borderColor: unlocked ? rarityColor : theme.border,
                    opacity: unlocked ? 1 : 0.5,
                  },
                ]}
              >
                <Text style={[s.icon, !unlocked && s.iconLocked]}>{badge.iconUrl}</Text>
                <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{badge.name}</Text>
                <Text style={[s.desc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {badge.description}
                </Text>
                <Text style={[s.rarity, { color: rarityColor }]}>{badge.rarity}</Text>
              </View>
            )
          })}
        </View>

        {allBadges.length === 0 && all.isLoading ? (
          <Text style={[s.loading, { color: theme.textSecondary }]}>{t("common:loading", "Loading…")}</Text>
        ) : null}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  hero: { borderRadius: 32, padding: 20, alignItems: "center", marginBottom: 20, overflow: "hidden" },
  heroLabel: { color: "#91A1B4", fontSize: 11, fontWeight: "700", letterSpacing: 1, opacity: 0.85 },
  heroValue: { color: colors.ink, fontSize: 44, fontWeight: "800", marginTop: 4 },
  heroDenom: { fontSize: 24, fontWeight: "700", opacity: 0.7 },
  progressTrack: { width: "100%", height: 6, backgroundColor: "rgba(163,177,198,0.18)", borderRadius: 3, marginTop: 12, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.cyan, borderRadius: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "31.5%", padding: 12, borderRadius: 24, borderWidth: 1, alignItems: "center", minHeight: 130 },
  icon: { fontSize: 36, marginBottom: 6 },
  iconLocked: { opacity: 0.6 },
  name: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  desc: { fontSize: 10, marginTop: 4, textAlign: "center", lineHeight: 14 },
  rarity: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginTop: 6 },
  loading: { textAlign: "center", paddingVertical: 40 },
})
