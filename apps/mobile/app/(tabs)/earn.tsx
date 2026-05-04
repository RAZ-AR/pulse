import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { fonts, gradients, useTheme } from "../../src/lib/theme"
import { NeuCard, NeuInset } from "../../src/components/neu"

const TX_ICONS: Record<string, string> = {
  PARTNER_PURCHASE: "🏪",
  RECEIPT_SCAN: "📷",
  CHECKIN_PHOTO: "📍",
  REWARD_REDEEMED: "🎁",
  REFERRAL: "🤝",
  GIFT_RECEIVED: "💝",
  GIFT_SENT: "🎁",
  CHALLENGE_COMPLETE: "🏆",
  BONUS: "✨",
}

export default function EarnScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const history = trpc.transaction.history.useQuery({ limit: 6 })

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const txs = history.data?.transactions ?? []

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("earnPoints", "Earn Points")}
      </Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        {t("partnersBeatScans", "Partners give up to 6× more than scanning")}
      </Text>

      {/* Balance pill */}
      <NeuInset style={s.balance}>
        <Text style={[s.balanceLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("balance", "Balance").toUpperCase()}
        </Text>
        <Text style={[s.balanceValue, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
          {total.toLocaleString()} pts
        </Text>
      </NeuInset>

      {/* Earn methods */}
      <View style={{ gap: 12, marginBottom: 28 }}>
        <EarnMethod
          gradient={gradients.pink}
          icon="📷"
          title={t("scanReceipt", "Scan Receipt")}
          sub={t("scanReceiptSub", "1pt / 500 RSD · any venue")}
          note={t("worksEverywhere", "Works everywhere")}
          onPress={() => router.push("/scan")}
        />
        <EarnMethod
          gradient={gradients.blue}
          icon="📍"
          title={t("checkinPhoto", "Check-in Photo")}
          sub={t("checkinPhotoSub", "5 pts · with geolocation")}
          note={t("plusStreakBonus", "+ Streak bonus")}
          onPress={() => router.push("/checkin")}
        />
        <EarnMethod
          gradient={gradients.mint}
          icon="👟"
          title={t("stepCounter", "Step Counter")}
          sub={t("stepCounterSub", "+1.1–1.3× multiplier")}
          note={t("connectHealth", "Connect Health")}
          onPress={() => router.push("/steps")}
        />
      </View>

      {/* Recent activity */}
      <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("recentActivity", "Recent Activity")}
      </Text>
      {txs.length === 0 ? (
        <NeuCard style={{ padding: 20, alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {t("noActivityYet", "No activity yet")}
          </Text>
        </NeuCard>
      ) : (
        <NeuCard style={{ padding: 0 }}>
          {txs.map((tx, i) => {
            const isEarn = tx.pointsEarned > 0
            return (
              <View
                key={tx.id}
                style={[
                  s.txRow,
                  i < txs.length - 1 && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 },
                ]}
              >
                <View style={[s.txIcon, theme.shadowRaisedSm, { backgroundColor: theme.bg }]}>
                  <Text style={{ fontSize: 16 }}>{TX_ICONS[tx.type] ?? "·"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.txTitle, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                    {tx.venue?.name ?? "PULSE"}
                  </Text>
                  <Text style={[s.txDate, { color: theme.textSecondary }]}>
                    {new Date(tx.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                    {tx.amount ? ` · ${tx.amount.toLocaleString()} ${tx.currency ?? ""}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    s.txValue,
                    { color: isEarn ? "#5FEFC0" : "#FF85D2", fontFamily: fonts.displayHeavy },
                  ]}
                >
                  {isEarn ? "+" : ""}{tx.pointsEarned}
                </Text>
              </View>
            )
          })}
        </NeuCard>
      )}
    </ScrollView>
  )
}

function EarnMethod({
  gradient, icon, title, sub, note, onPress,
}: {
  gradient: readonly [string, string, ...string[]]
  icon: string; title: string; sub: string; note: string; onPress: () => void
}) {
  return (
    <NeuCard
      gradient={gradient}
      onPress={onPress}
      style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
    >
      <View style={s.methodIcon}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.methodTitle, { fontFamily: fonts.bodyBold }]}>{title}</Text>
        <Text style={s.methodSub}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.methodNote, { fontFamily: fonts.bodyBold }]}>{note}</Text>
        <Text style={s.methodArrow}>→</Text>
      </View>
    </NeuCard>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 20 },

  balance: { padding: 16, marginBottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { fontSize: 11, letterSpacing: 1 },
  balanceValue: { fontSize: 22 },

  methodIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  methodTitle: { color: "#FFF", fontSize: 16, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  methodSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 2 },
  methodNote: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  methodArrow: { color: "rgba(255,255,255,0.6)", fontSize: 18 },

  sectionTitle: { fontSize: 18, marginBottom: 12 },

  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  txIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 13 },
  txDate: { fontSize: 11, marginTop: 1 },
  txValue: { fontSize: 15 },
})
