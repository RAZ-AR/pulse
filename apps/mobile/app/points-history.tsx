import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, neonColors, useTheme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { LavaLampSurface, NeuCard, VolumeGradient } from "../src/components/neu"

type Filter = "all" | "earned" | "spent"

const TX_ICONS: Record<string, string> = {
  PARTNER_PURCHASE: "P",
  RECEIPT_SCAN: "S",
  CHECKIN_PHOTO: "C",
  REWARD_REDEEMED: "R",
  REFERRAL: "+",
  GIFT_RECEIVED: "G",
  GIFT_SENT: "G",
  CHALLENGE_COMPLETE: "✓",
  BONUS: "✦",
}

const TX_LABELS: Record<string, string> = {
  PARTNER_PURCHASE: "Partner purchase",
  RECEIPT_SCAN: "Receipt scan",
  CHECKIN_PHOTO: "Check-in",
  REWARD_REDEEMED: "Reward redeemed",
  REFERRAL: "Referral bonus",
  GIFT_RECEIVED: "Gift received",
  GIFT_SENT: "Gift sent",
  CHALLENGE_COMPLETE: "Challenge complete",
  BONUS: "Bonus",
}

function fmt(n: number) {
  return n.toLocaleString()
}

function txPoints(tx: {
  type: string
  pointsEarned: number
  pointsFromEarned: number
  pointsFromWelcome: number
}) {
  if (tx.type === "REWARD_REDEEMED" || tx.type === "GIFT_SENT") {
    return -(tx.pointsFromEarned + tx.pointsFromWelcome + tx.pointsEarned)
  }
  return tx.pointsEarned
}

export default function PointsHistoryScreen() {
  const theme = useTheme()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const me = trpc.user.me.useQuery()
  const history = trpc.transaction.history.useQuery({ limit: 40 })

  const available = (me.data?.earnedPoints ?? 0) + (me.data?.welcomePoints ?? 0)
  const lifetime = Math.max(me.data?.totalEarnedLifetime ?? 0, available + (me.data?.spentPoints ?? 0))
  const spent = me.data?.spentPoints ?? 0
  const txs = history.data?.transactions ?? []
  const filteredTxs = useMemo(() => {
    return txs.filter((tx) => {
      const points = txPoints(tx)
      if (filter === "earned") return points > 0
      if (filter === "spent") return points < 0
      return true
    })
  }, [filter, txs])

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { fontFamily: fonts.bodyBold }]}>POINTS</Text>
          <Text style={[s.title, { fontFamily: fonts.displayHeavy }]}>History</Text>
        </View>
      </View>

      <LavaLampSurface intensity="glass" style={[s.summary, isRainbow ? {} : theme.shadowRaised]}>
        <View style={s.summaryGlow} />
        <Metric label="available" value={available} index={0} isRainbow={isRainbow} />
        <Metric label="lifetime" value={lifetime} index={1} isRainbow={isRainbow} />
        <Metric label="spent" value={spent} muted index={2} isRainbow={isRainbow} />
      </LavaLampSurface>

      <View style={s.filters}>
        {([
          ["all", "All"],
          ["earned", "Earned"],
          ["spent", "Spent"],
        ] as const).map(([key, label]) => {
          const active = filter === key
          if (active && isRainbow) {
            return (
              <VolumeGradient key={key} colors={["#8B3DFF", "#2B6EFF"]} shadowColor="#8B3DFF" shadowOpacity={0.30} borderRadius={99} onPress={() => setFilter(key)} style={[s.filterChip, { flex: 1 }]}>
                <Text style={[s.filterText, { color: "#FFFFFF", fontFamily: fonts.bodyBold }]}>{label}</Text>
              </VolumeGradient>
            )
          }
          return (
            <Pressable key={key} onPress={() => setFilter(key)} style={[s.filterChip, active ? s.filterChipActive : s.filterChipIdle]}>
              <Text style={[s.filterText, { color: active ? (isRainbow ? theme.text : colors.ink) : "#91A1B4", fontFamily: fonts.bodyBold }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {history.isLoading ? (
        <NeuCard style={s.emptyCard}>
          <Text style={s.emptyText}>Loading history...</Text>
        </NeuCard>
      ) : filteredTxs.length === 0 ? (
        <NeuCard style={s.emptyCard}>
          <Text style={s.emptyText}>No point activity yet</Text>
        </NeuCard>
      ) : (
        <NeuCard style={s.listCard}>
          {filteredTxs.map((tx, index) => {
            const points = txPoints(tx)
            const positive = points >= 0
            return (
              <View key={tx.id} style={[s.txRow, index < filteredTxs.length - 1 && s.txBorder]}>
                <View style={[s.txIcon, positive ? (isRainbow ? s.txIconEarnRainbow : s.txIconEarn) : (isRainbow ? s.txIconSpendRainbow : s.txIconSpend)]}>
                  <Text style={[s.txIconText, { fontFamily: fonts.displayHeavy }]}>{TX_ICONS[tx.type] ?? "P"}</Text>
                </View>
                <View style={s.txMain}>
                  <Text style={[s.txTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {tx.venue?.name ?? TX_LABELS[tx.type] ?? "PULSE"}
                  </Text>
                  <Text style={s.txMeta} numberOfLines={1}>
                    {TX_LABELS[tx.type] ?? tx.type} · {new Date(tx.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                  </Text>
                </View>
                <Text style={[s.txPoints, positive ? s.txPointsEarn : s.txPointsSpend, { fontFamily: fonts.displayHeavy }]}>
                  {positive ? "+" : "-"}{fmt(Math.abs(points))}
                </Text>
              </View>
            )
          })}
        </NeuCard>
      )}
    </ScrollView>
  )
}

const METRIC_RAINBOW = [
  ["#8B3DFF", "#2B6EFF"] as const,
  ["#2B6EFF", "#00F5FF"] as const,
  ["#FF2D9B", "#8B3DFF"] as const,
]

function Metric({ label, value, muted, index, isRainbow }: { label: string; value: number; muted?: boolean; index?: number; isRainbow?: boolean }) {
  if (isRainbow) {
    const grad = METRIC_RAINBOW[(index ?? 0) % METRIC_RAINBOW.length]!
    return (
      <VolumeGradient colors={grad} shadowColor={grad[0]} shadowOpacity={0.32} borderRadius={24} style={[s.metric, { minHeight: 104 }]}>
        <Text style={[s.metricValue, { color: "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{fmt(value)}</Text>
        <Text style={[s.metricLabel, { color: "rgba(255,255,255,0.75)", fontFamily: fonts.bodyBold }]}>{label}</Text>
      </VolumeGradient>
    )
  }
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, muted && s.metricMuted, { fontFamily: fonts.displayHeavy }]}>{fmt(value)}</Text>
      <Text style={[s.metricLabel, { fontFamily: fonts.bodyBold }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 116 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FBFF", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 2 },
  backText: { color: "#91A1B4", fontSize: 32, lineHeight: 34, fontWeight: "800" },
  kicker: { color: "#B0D4E3", fontSize: 11, letterSpacing: 1.8 },
  title: { color: "#6E7D8E", fontSize: 34, lineHeight: 38, letterSpacing: 0 },
  summary: { minHeight: 132, borderRadius: 34, padding: 13, marginBottom: 14, flexDirection: "row", gap: 8, overflow: "hidden" },
  summaryGlow: { position: "absolute", right: -70, top: -80, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(236,255,235,0.34)" },
  metric: { flex: 1, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.62)", alignItems: "center", justifyContent: "center", minHeight: 104 },
  metricValue: { color: "#6E7D8E", fontSize: 25, lineHeight: 29, letterSpacing: 0 },
  metricMuted: { color: "#91A1B4" },
  metricLabel: { color: "#91A1B4", fontSize: 9, marginTop: 6, textTransform: "uppercase" },
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: { flex: 1, borderRadius: 99, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: "rgba(249,251,255,0.58)" },
  filterText: { fontSize: 12 },
  emptyCard: { padding: 20, alignItems: "center" },
  emptyText: { color: "#91A1B4", fontSize: 13, fontWeight: "700" },
  listCard: { padding: 0, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  txBorder: { borderBottomColor: "rgba(163,177,198,0.22)", borderBottomWidth: 1 },
  txIcon: { width: 44, height: 44, borderRadius: 18, alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.2, shadowRadius: 7, elevation: 2 },
  txIconEarn: { backgroundColor: "rgba(236,255,235,0.9)" },
  txIconSpend: { backgroundColor: "rgba(255,244,254,0.9)" },
  txIconEarnRainbow: { backgroundColor: "rgba(0,245,255,0.15)" },
  txIconSpendRainbow: { backgroundColor: "rgba(255,45,155,0.12)" },
  txIconText: { color: "#7A8EA3", fontSize: 17 },
  txMain: { flex: 1, minWidth: 0 },
  txTitle: { color: "#6E7D8E", fontSize: 15 },
  txMeta: { color: "#91A1B4", fontSize: 11, marginTop: 2 },
  txPoints: { fontSize: 19, minWidth: 64, textAlign: "right" },
  txPointsEarn: { color: "#67C887" },
  txPointsSpend: { color: "#D96AA7" },
})
