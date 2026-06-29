import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { ModeHeader } from "../../src/components/gadget"
import { trpc } from "../../src/lib/trpc"
import { fonts, space, typeScale, useTheme } from "../../src/lib/theme"

// ── Device (Teenage-Engineering) tokens ──
const ORANGE = "#fd4600"
const ORANGE_EDGE = "#c83700"
const INK = "#015634"
const DIM = "#8C887E"
const CREAM = "#efeeea"
const LCD = "#DBDBD7"
const LCD_EDGE = "#C4C4BE"
const LCD_INK = "#015634"
const EDGE = "rgba(110,102,86,0.18)"
const HILITE = "rgba(255,255,255,0.95)"

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

  const welcomeExpiresAt = me.data?.welcomeExpiresAt
  const welcomeDaysLeft = welcomeExpiresAt
    ? Math.max(0, Math.ceil((new Date(welcomeExpiresAt).getTime() - Date.now()) / 86_400_000))
    : null
  const showExpiryWarning = welcomePoints > 0 && welcomeDaysLeft !== null && welcomeDaysLeft <= 7

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: theme.bg }]}
      contentContainerStyle={s.content}
      scrollEventThrottle={16}
      removeClippedSubviews
    >
      <ModeHeader kicker="REWARDS" title={t("title", "Rewards")} onFace={() => router.push("/" as Parameters<typeof router.push>[0])} />
      {/* ── Balance panel — cream device card with LCD balance cells ── */}
      <View style={s.hero}>
        <Text style={[s.heroSub, { fontFamily: fonts.bodyBold, color: DIM }]}>{t("subtitle", "Redeem points for real perks")}</Text>
        <View style={s.balanceRow}>
          <View style={s.balanceCell}>
            <Text style={[s.balanceValue, { fontFamily: fonts.pixel }]}>{total.toLocaleString()}</Text>
            <Text style={[s.balanceLabel, { fontFamily: fonts.pixel }]}>{t("common:available", "Available").toUpperCase()}</Text>
          </View>
          {welcomePoints > 0 ? (
            <View style={s.balanceCell}>
              <Text style={[s.balanceValue, { fontFamily: fonts.pixel }]}>{welcomePoints}</Text>
              <Text style={[s.balanceLabel, { fontFamily: fonts.pixel }]}>{t("common:welcome", "Welcome").toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {showExpiryWarning ? (
        <View style={s.expiryBanner}>
          <Text style={[s.expiryText, { fontFamily: fonts.bodyBold }]}>
            ⚠️ {welcomePoints} welcome pts истекают через {welcomeDaysLeft === 0 ? "сегодня" : `${welcomeDaysLeft} дн.`}
          </Text>
          <Text style={[s.expirySub, { color: DIM }]}>Потратьте баллы сейчас — они не сгорят у партнёров</Text>
        </View>
      ) : null}

      <View style={s.filters}>
        <FilterPill label={t("all", "All")} active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterPill label={t("welcomeOnly", "Welcome ≤100")} active={filter === "welcome"} onPress={() => setFilter("welcome")} />
      </View>

      {filtered.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={{ color: DIM, fontFamily: fonts.bodyBold }}>{t("noRewardsAvailable")}</Text>
        </View>
      ) : (
        <View style={s.grid}>
          {filtered.map((r, i) => {
            const canRedeem = total >= r.pointsCost
            const stockLeft = r.stockLimit !== null ? r.stockLimit - r.redeemedCount : null
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
                featured={i % 3 === 0}
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
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.pill, active ? s.pillActive : s.pillIdle, pressed && s.keyPressed]}>
      <Text style={[s.pillText, { color: active ? ORANGE_EDGE : DIM, fontFamily: fonts.pixel }]}>{label}</Text>
    </Pressable>
  )
}

function RewardCard({
  title, venue, points, ptsLabel, leftLabel, useLabel, canRedeem, featured, onPress,
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
  return (
    <Pressable onPress={onPress} style={s.rewardPressable}>
      <View style={[s.rewardCard, featured && s.rewardCardFeatured]}>
        <View style={s.rewardLogo}>
          <Text style={s.rewardLogoText}>✦</Text>
        </View>
        <Text style={[s.rewardTitle, { color: INK, fontFamily: fonts.displayHeavy }]} numberOfLines={2}>{title}</Text>
        <Text style={[s.rewardVenue, { color: DIM, fontFamily: fonts.bodyBold }]} numberOfLines={1}>{venue}</Text>
        {leftLabel ? <Text style={[s.stockHint, { fontFamily: fonts.pixel }]}>{leftLabel}</Text> : null}
        <View style={{ flex: 1 }} />
        <View style={s.rewardFoot}>
          <View style={s.costChip}>
            <Text style={[s.rewardCost, { fontFamily: fonts.pixel }]}>{points}</Text>
            <Text style={[s.rewardCostUnit, { fontFamily: fonts.pixel }]}>{ptsLabel.toUpperCase()}</Text>
          </View>
          {canRedeem ? (
            <View style={s.useBadge}>
              <Text style={[s.useBadgeText, { color: "#FFFFFF", fontFamily: fonts.pixel }]}>{useLabel.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const clayCard = {
  backgroundColor: CREAM,
  borderTopWidth: 1.5,
  borderTopColor: HILITE,
  borderBottomWidth: 5,
  borderBottomColor: EDGE,
  shadowColor: "#9A958A",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 16,
  elevation: 5,
} as const

const lcdPlate = { backgroundColor: LCD, borderWidth: 2, borderColor: LCD_EDGE } as const

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: space.screen, paddingBottom: space.bottomGutter },

  hero: { ...clayCard, borderRadius: 26, padding: 16, marginBottom: 14 },
  heroHead: { marginBottom: 12 },
  kicker: { color: DIM, fontSize: 7, letterSpacing: 0.5, marginBottom: 6 },
  title: { fontSize: typeScale.display.size, lineHeight: typeScale.display.line },
  heroSub: { fontSize: 13, marginBottom: 16 },
  balanceRow: { flexDirection: "row", gap: 10 },
  balanceCell: { ...lcdPlate, flex: 1, borderRadius: 14, padding: 14, alignItems: "flex-start", gap: 8 },
  balanceLabel: { fontSize: 6, letterSpacing: 0.5, color: DIM },
  balanceValue: { fontSize: 20, color: LCD_INK },

  expiryBanner: { backgroundColor: "#F6E2D2", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(217,138,78,0.4)" },
  expiryText: { fontSize: 13, marginBottom: 3, color: ORANGE_EDGE },
  expirySub: { fontSize: 12 },

  filters: { flexDirection: "row", gap: 10, marginBottom: 18 },
  pill: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  pillActive: { backgroundColor: CREAM, borderColor: EDGE, borderBottomWidth: 3, borderBottomColor: ORANGE },
  pillIdle: { backgroundColor: "#efeeea", borderColor: "rgba(110,102,86,0.1)" },
  keyPressed: { transform: [{ translateY: 2 }] },
  pillText: { fontSize: 9, letterSpacing: 0.5 },

  emptyCard: { ...clayCard, padding: 24, alignItems: "center", borderRadius: 18, marginTop: 4 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rewardPressable: { width: "48%" },
  rewardCard: { ...clayCard, padding: 14, minHeight: 150, borderRadius: 20 },
  rewardCardFeatured: { borderBottomColor: ORANGE },
  rewardLogo: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 18, backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)" },
  rewardLogoText: { fontSize: 16, fontWeight: "900", color: "#8C887E" },
  rewardTitle: { fontSize: typeScale.card.size, lineHeight: typeScale.card.line, marginBottom: 7 },
  rewardVenue: { fontSize: 12, marginBottom: 4 },
  stockHint: { fontSize: 6, color: ORANGE_EDGE, marginTop: 2 },
  rewardFoot: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  costChip: { ...lcdPlate, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, alignItems: "center" },
  rewardCost: { fontSize: 14, color: LCD_INK, lineHeight: 16 },
  rewardCostUnit: { fontSize: 5, color: DIM, marginTop: 2 },
  useBadge: { backgroundColor: ORANGE, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 3, borderBottomColor: ORANGE_EDGE },
  useBadgeText: { fontSize: 7, letterSpacing: 0.5 },
})
