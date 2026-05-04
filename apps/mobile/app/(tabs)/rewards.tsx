import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../../src/lib/trpc"
import { fonts, gradients, useTheme } from "../../src/lib/theme"
import { NeuCard } from "../../src/components/neu"

const REWARD_GRADIENTS = [
  gradients.rainbow,
  gradients.rainbow2,
  gradients.rainbow3,
  gradients.rainbow4,
  gradients.pink,
  gradients.blue,
] as const

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
      <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("title", "Rewards")}
      </Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        {t("subtitle", "Redeem points for real perks")}
      </Text>

      {/* Balance hero */}
      <NeuCard gradient={gradients.rainbow} style={s.balanceHero}>
        <View>
          <Text style={s.balanceLabel}>{t("common:available", "Available").toUpperCase()}</Text>
          <Text style={[s.balanceValue, { fontFamily: fonts.displayHeavy }]}>
            {total.toLocaleString()} pts
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.balanceLabel}>{t("common:welcome", "Welcome 🎁").toUpperCase()}</Text>
          <Text style={[s.welcomeValue, { fontFamily: fonts.displayHeavy }]}>{welcomePoints}</Text>
        </View>
      </NeuCard>

      {/* Filter pills */}
      <View style={s.filters}>
        <FilterPill
          label={t("all", "All")}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterPill
          label={`🎁 ${t("welcomeOnly", "Welcome ≤100")}`}
          active={filter === "welcome"}
          onPress={() => setFilter("welcome")}
        />
      </View>

      {/* Reward grid */}
      {filtered.length === 0 ? (
        <NeuCard style={{ padding: 24, alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: theme.textSecondary }}>{t("noRewards", "No rewards available yet")}</Text>
        </NeuCard>
      ) : (
        <View style={s.grid}>
          {filtered.map((r, i) => {
            const grad = REWARD_GRADIENTS[i % REWARD_GRADIENTS.length]!
            const canRedeem = total >= r.pointsCost
            const stockLeft = r.stockLimit !== null ? r.stockLimit - r.redeemedCount : null
            return (
              <NeuCard
                key={r.id}
                gradient={grad}
                onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
                style={s.rewardCard}
              >
                <View style={s.rewardBlob} />
                <Text style={[s.rewardTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text style={s.rewardVenue} numberOfLines={1}>{r.venue.name}</Text>
                {stockLeft !== null && stockLeft <= 5 ? (
                  <Text style={[s.stockHint, { fontFamily: fonts.bodyBold }]}>⚠ {stockLeft} left</Text>
                ) : null}
                <View style={{ flex: 1 }} />
                <View style={s.rewardFoot}>
                  <View>
                    <Text style={[s.rewardCost, { fontFamily: fonts.displayHeavy }]}>{r.pointsCost}</Text>
                    <Text style={s.rewardCostUnit}>pts</Text>
                  </View>
                  {canRedeem ? (
                    <View style={s.useBadge}>
                      <Text style={[s.useBadgeText, { fontFamily: fonts.bodyBold }]}>Use</Text>
                    </View>
                  ) : null}
                </View>
              </NeuCard>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme()
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={gradients.rainbow as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.pill, theme.shadowGlow]}
        >
          <Text style={[s.pillTextActive, { fontFamily: fonts.bodyBold }]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      style={[s.pill, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}
    >
      <Text style={[s.pillText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 16 },

  balanceHero: { padding: 18, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  balanceValue: { color: "#FFF", fontSize: 28, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  welcomeValue: { color: "#FFF", fontSize: 20 },

  filters: { flexDirection: "row", gap: 10, marginBottom: 20 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  pillText: { fontSize: 13 },
  pillTextActive: { color: "#FFF", fontSize: 13, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rewardCard: { width: "48%", padding: 16, minHeight: 160 },
  rewardBlob: { position: "absolute", top: -16, right: -16, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.15)" },
  rewardTitle: { color: "#FFF", fontSize: 13, marginBottom: 4, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rewardVenue: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 4 },
  stockHint: { color: "#FFF", fontSize: 10, opacity: 0.85 },
  rewardFoot: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  rewardCost: { color: "#FFF", fontSize: 24, lineHeight: 26, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  rewardCostUnit: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "700" },
  useBadge: { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  useBadgeText: { color: "#FFF", fontSize: 12 },
})
