import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../src/lib/trpc"
import { fonts, useTheme } from "../src/lib/theme"

// ── Device (Teenage-Engineering) tokens ──
const ORANGE_EDGE = "#c83700"
const GREEN = "#013d24"
const INK = "#015634"
const DIM = "#8C887E"
const CREAM = "#efeeea"
const LCD = "#DBDBD7"
const LCD_EDGE = "#C4C4BE"
const LCD_INK = "#015634"
const EDGE = "rgba(110,102,86,0.18)"
const HILITE = "rgba(255,255,255,0.95)"

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
  const router = useRouter()
  const { t } = useTranslation(["common", "transactions"])
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
          <Text style={[s.kicker, { fontFamily: fonts.pixel }]}>POINTS</Text>
          <Text style={[s.title, { fontFamily: fonts.displayHeavy }]}>{t("historyTitle")}</Text>
        </View>
      </View>

      {/* Summary — cream device card with LCD metric cells */}
      <View style={s.summary}>
        <Metric label={t("metricAvailable")} value={available} />
        <Metric label={t("metricLifetime")} value={lifetime} />
        <Metric label={t("metricSpent")} value={spent} muted />
      </View>

      <View style={s.filters}>
        {([
          { key: "all" as Filter,    label: t("filterAll")    },
          { key: "earned" as Filter, label: t("filterEarned") },
          { key: "spent" as Filter,  label: t("filterSpent")  },
        ]).map(({ key, label }) => {
          const active = filter === key
          return (
            <Pressable key={key} onPress={() => setFilter(key)} style={[s.filterChip, active ? s.filterChipActive : s.filterChipIdle]}>
              <Text style={[s.filterText, { color: active ? ORANGE_EDGE : DIM, fontFamily: fonts.pixel }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {history.isLoading ? (
        <View style={s.emptyCard}><Text style={s.emptyText}>{t("loading")}</Text></View>
      ) : filteredTxs.length === 0 ? (
        <View style={s.emptyCard}><Text style={s.emptyText}>{t("noHistoryYet")}</Text></View>
      ) : (
        <View style={s.listCard}>
          {filteredTxs.map((tx, index) => {
            const points = txPoints(tx)
            const positive = points >= 0
            return (
              <View key={tx.id} style={[s.txRow, index < filteredTxs.length - 1 && s.txBorder]}>
                <View style={[s.txIcon, positive ? s.txIconEarn : s.txIconSpend]}>
                  <Text style={[s.txIconText, { fontFamily: fonts.pixel, color: positive ? GREEN : ORANGE_EDGE }]}>{TX_ICONS[tx.type] ?? "P"}</Text>
                </View>
                <View style={s.txMain}>
                  <Text style={[s.txTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {tx.venue?.name ?? t(`transactions:types.${tx.type}`, tx.type)}
                  </Text>
                  <Text style={[s.txMeta, { fontFamily: fonts.pixel }]} numberOfLines={1}>
                    {t(`transactions:types.${tx.type}`, tx.type)} · {new Date(tx.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                  </Text>
                </View>
                <Text style={[s.txPoints, { color: positive ? GREEN : ORANGE_EDGE, fontFamily: fonts.pixel }]}>
                  {positive ? "+" : "-"}{fmt(Math.abs(points))}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

function Metric({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, muted && s.metricMuted, { fontFamily: fonts.pixel }]}>{fmt(value)}</Text>
      <Text style={[s.metricLabel, { fontFamily: fonts.pixel }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 116 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backButton: {
    width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: CREAM, borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 4, borderBottomColor: EDGE,
  },
  backText: { color: DIM, fontSize: 30, lineHeight: 32, fontWeight: "800" },
  kicker: { color: DIM, fontSize: 7, letterSpacing: 0.5 },
  title: { color: INK, fontSize: 30, lineHeight: 34, letterSpacing: 0 },

  summary: {
    borderRadius: 22, padding: 12, marginBottom: 14, flexDirection: "row", gap: 8,
    backgroundColor: CREAM, borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 5, borderBottomColor: EDGE,
    shadowColor: "#9A958A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 5,
  },
  metric: { flex: 1, borderRadius: 14, backgroundColor: LCD, borderWidth: 2, borderColor: LCD_EDGE, alignItems: "center", justifyContent: "center", minHeight: 96, gap: 8, paddingVertical: 10 },
  metricValue: { color: LCD_INK, fontSize: 17, lineHeight: 21, letterSpacing: 0 },
  metricMuted: { color: DIM },
  metricLabel: { color: DIM, fontSize: 6, letterSpacing: 0.5, textAlign: "center", paddingHorizontal: 4 },

  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  filterChipActive: { backgroundColor: CREAM, borderColor: EDGE, borderBottomWidth: 3, borderBottomColor: "#fd4600" },
  filterChipIdle: { backgroundColor: "#efeeea", borderColor: "rgba(110,102,86,0.1)" },
  filterText: { fontSize: 8, letterSpacing: 0.5 },

  emptyCard: {
    padding: 20, alignItems: "center", borderRadius: 16,
    backgroundColor: CREAM, borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 4, borderBottomColor: EDGE,
  },
  emptyText: { color: DIM, fontSize: 13, fontWeight: "700" },

  listCard: {
    padding: 0, overflow: "hidden", borderRadius: 16,
    backgroundColor: CREAM, borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 4, borderBottomColor: EDGE,
  },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  txBorder: { borderBottomColor: "rgba(110,102,86,0.12)", borderBottomWidth: 1 },
  txIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  txIconEarn: { backgroundColor: "#DCEFE6", borderColor: "rgba(95,174,146,0.4)" },
  txIconSpend: { backgroundColor: "#F6E2D2", borderColor: "rgba(217,138,78,0.4)" },
  txIconText: { fontSize: 12 },
  txMain: { flex: 1, minWidth: 0 },
  txTitle: { color: INK, fontSize: 15 },
  txMeta: { color: DIM, fontSize: 7, marginTop: 4, letterSpacing: 0.3 },
  txPoints: { fontSize: 13, minWidth: 56, textAlign: "right" },
})
