import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

export default function RewardsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("rewards")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const rewards = trpc.reward.list.useQuery({ limit: 50 })

  const totalPoints = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={[s.balance, { backgroundColor: colors.pink }]}>
        <Text style={s.balanceLabel}>{t("common:pointsBalance", "Points balance")}</Text>
        <Text style={s.balanceValue}>{totalPoints.toLocaleString()}</Text>
      </View>

      {!rewards.data || rewards.data.rewards.length === 0 ? (
        <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary }}>{t("noRewards", "No rewards available yet")}</Text>
        </View>
      ) : (
        <View style={s.list}>
          {rewards.data.rewards.map((r) => {
            const canRedeem = totalPoints >= r.pointsCost
            const stockLeft = r.stockLimit !== null ? r.stockLimit - r.redeemedCount : null
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
                style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: theme.text }]}>{r.title}</Text>
                  <Text style={[s.venue, { color: theme.textSecondary }]}>{r.venue.name} · {r.venue.city}</Text>
                  {r.description ? (
                    <Text style={[s.desc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {r.description}
                    </Text>
                  ) : null}
                  {stockLeft !== null && stockLeft <= 5 ? (
                    <Text style={s.lowStock}>{t("only", "Only")} {stockLeft} {t("left", "left")}</Text>
                  ) : null}
                </View>
                <View style={s.right}>
                  <Text style={[s.cost, { color: canRedeem ? colors.mint : theme.textSecondary }]}>
                    {r.pointsCost}
                  </Text>
                  <Text style={[s.costLabel, { color: theme.textSecondary }]}>pts</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  balance: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 20 },
  balanceLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", opacity: 0.85 },
  balanceValue: { color: "#FFF", fontSize: 32, fontWeight: "800", marginTop: 2 },
  empty: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  list: { gap: 10 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 15, fontWeight: "700" },
  venue: { fontSize: 12, marginTop: 2 },
  desc: { fontSize: 12, marginTop: 6 },
  lowStock: { fontSize: 11, color: colors.pink, fontWeight: "600", marginTop: 4 },
  right: { alignItems: "center", minWidth: 56 },
  cost: { fontSize: 22, fontWeight: "800" },
  costLabel: { fontSize: 11, fontWeight: "600" },
})
