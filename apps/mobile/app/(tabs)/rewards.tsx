import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../src/lib/theme"
import { LavaLampSurface, NeuCard } from "../../src/components/neu"

export default function RewardsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("rewards")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const rewards = trpc.reward.list.useQuery({ limit: 50 })
  const [filter, setFilter] = useState<"all" | "welcome">("all")

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const welcomePoints = me.data?.welcomePoints ?? 0
  const all = rewards.data?.rewards ?? []
  const filtered = filter === "welcome" ? all.filter((r) => r.pointsCost <= 100) : all

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <LavaLampSurface style={s.hero}>
        <View style={s.heroHead}>
          <View>
            <Text style={[s.kicker, { fontFamily: fonts.bodyBold }]}>REWARDS</Text>
            <Text style={[s.title, { fontFamily: fonts.displayHeavy }]}>{t("title", "Rewards")}</Text>
          </View>
          <View style={s.pointsPill}>
            <Text style={[s.pointsPillText, { fontFamily: fonts.bodyBold }]}>{total.toLocaleString()} {t("pts")}</Text>
          </View>
        </View>
        <Text style={[s.heroSub, { fontFamily: fonts.bodyBold }]}>
          {t("subtitle", "Redeem points for real perks")}
        </Text>
        <View style={s.balanceRow}>
          <View style={s.balanceCell}>
            <Text style={[s.balanceValue, { fontFamily: fonts.displayHeavy }]}>{total.toLocaleString()}</Text>
            <Text style={[s.balanceLabel, { fontFamily: fonts.bodyBold }]}>{t("common:available", "Available").toUpperCase()}</Text>
          </View>
          <View style={[s.balanceCell, s.balanceCellLight]}>
            <Text style={[s.balanceValueDark, { fontFamily: fonts.displayHeavy }]}>{welcomePoints}</Text>
            <Text style={[s.balanceLabelDark, { fontFamily: fonts.bodyBold }]}>{t("common:welcome", "Welcome").toUpperCase()}</Text>
          </View>
        </View>
      </LavaLampSurface>

      <View style={s.filters}>
        <FilterPill
          label={t("all", "All")}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterPill
          label={t("welcomeOnly", "Welcome ≤100")}
          active={filter === "welcome"}
          onPress={() => setFilter("welcome")}
        />
      </View>

      {/* Reward grid */}
      {filtered.length === 0 ? (
        <NeuCard style={{ padding: 24, alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: theme.textSecondary }}>{t("noRewardsAvailable")}</Text>
        </NeuCard>
      ) : (
        <View style={s.grid}>
          {filtered.map((r, i) => {
            const canRedeem = total >= r.pointsCost
            const stockLeft = r.stockLimit !== null ? r.stockLimit - r.redeemedCount : null
            const featured = i % 3 === 0
            return (
              <RewardCard
                key={r.id}
                title={r.title}
                venue={r.venue.name}
                points={r.pointsCost}
                ptsLabel={t("pts")}
                leftLabel={stockLeft !== null && stockLeft <= 5 ? t("left", { count: stockLeft }) : null}
                useLabel={t("use")}
                canRedeem={canRedeem}
                featured={featured}
                onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
              />
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LavaLampSurface style={s.pill} contentStyle={s.pillContent}>
          <Text style={[s.pillText, { color: "#FFFFFF", fontFamily: fonts.bodyBold }]}>{label}</Text>
        </LavaLampSurface>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={[s.pill, active ? s.pillActive : s.pillIdle]}>
      <Text style={[s.pillText, { color: active ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>{label}</Text>
    </Pressable>
  )
}

function RewardCard({
  title,
  venue,
  points,
  ptsLabel,
  leftLabel,
  useLabel,
  canRedeem,
  featured,
  onPress,
}: {
  title: string
  venue: string
  points: number
  ptsLabel: string
  leftLabel: string | null
  useLabel: string
  canRedeem: boolean
  featured: boolean
  onPress: () => void
}) {
  const content = (
    <>
      <View style={[s.rewardLogo, featured ? s.rewardLogoDark : s.rewardLogoLight]}>
        <Text style={[s.rewardLogoText, { color: featured ? "#FFFFFF" : colors.ink }]}>✦</Text>
      </View>
      <Text style={[s.rewardTitle, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[s.rewardVenue, { color: featured ? "#5A606C" : "rgba(255,255,255,0.76)", fontFamily: fonts.bodyBold }]} numberOfLines={1}>{venue}</Text>
      {leftLabel ? (
        <Text style={[s.stockHint, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>{leftLabel}</Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <View style={s.rewardFoot}>
        <View>
          <Text style={[s.rewardCost, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{points}</Text>
          <Text style={[s.rewardCostUnit, { color: featured ? "#5A606C" : "rgba(255,255,255,0.76)" }]}>{ptsLabel}</Text>
        </View>
        {canRedeem ? (
          <View style={[s.useBadge, { backgroundColor: featured ? "#FFFFFF" : "rgba(255,255,255,0.22)" }]}>
            <Text style={[s.useBadgeText, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>{useLabel}</Text>
          </View>
        ) : null}
      </View>
    </>
  )

  return (
    <Pressable onPress={onPress} style={s.rewardPressable}>
      {featured ? (
        <View style={[s.rewardCard, s.rewardCardCyan]}>{content}</View>
      ) : (
        <LavaLampSurface style={s.rewardCard}>{content}</LavaLampSurface>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  hero: { borderRadius: 32, padding: 18, marginBottom: 14, overflow: "hidden" },
  heroHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  kicker: { color: "rgba(255,255,255,0.62)", fontSize: 11, letterSpacing: 1.8 },
  title: { color: "#FFFFFF", fontSize: 36, lineHeight: 40 },
  pointsPill: { backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 99, paddingHorizontal: 15, paddingVertical: 10 },
  pointsPillText: { color: "#FFFFFF", fontSize: 12 },
  heroSub: { color: "rgba(255,255,255,0.64)", fontSize: 13, marginBottom: 16 },
  balanceRow: { flexDirection: "row", gap: 10 },
  balanceCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.20)", borderRadius: 24, padding: 14 },
  balanceCellLight: { backgroundColor: colors.cyan },
  balanceLabel: { color: "rgba(255,255,255,0.58)", fontSize: 10, letterSpacing: 1 },
  balanceValue: { color: "#FFFFFF", fontSize: 34, lineHeight: 36 },
  balanceLabelDark: { color: "#65707B", fontSize: 10, letterSpacing: 1 },
  balanceValueDark: { color: colors.ink, fontSize: 34, lineHeight: 36 },
  filters: { flexDirection: "row", gap: 10, marginBottom: 18 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99 },
  pillContent: { alignItems: "center" },
  pillActive: { backgroundColor: colors.lavaBase },
  pillIdle: { backgroundColor: "#FFFFFF" },
  pillText: { fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rewardPressable: { width: "48%" },
  rewardCard: { padding: 14, minHeight: 180, borderRadius: 30, overflow: "hidden" },
  rewardCardCyan: { backgroundColor: colors.cyan },
  rewardLogo: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  rewardLogoDark: { backgroundColor: colors.lavaPink },
  rewardLogoLight: { backgroundColor: "#FFFFFF" },
  rewardLogoText: { fontSize: 17, fontWeight: "900" },
  rewardTitle: { fontSize: 21, lineHeight: 23, marginBottom: 7 },
  rewardVenue: { fontSize: 12, marginBottom: 4 },
  stockHint: { fontSize: 10, opacity: 0.85 },
  rewardFoot: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  rewardCost: { fontSize: 25, lineHeight: 27 },
  rewardCostUnit: { fontSize: 10, fontWeight: "700" },
  useBadge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  useBadgeText: { fontSize: 12 },
})
