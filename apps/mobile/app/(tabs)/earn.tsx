import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, neonColors, useTheme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"
import { LavaLampSurface, NeuCard, VolumeGradient } from "../../src/components/neu"

const TX_ICONS: Record<string, string> = {
  PARTNER_PURCHASE: "P",
  RECEIPT_SCAN: "⌁",
  CHECKIN_PHOTO: "⌖",
  REWARD_REDEEMED: "□",
  REFERRAL: "+",
  GIFT_RECEIVED: "□",
  GIFT_SENT: "□",
  CHALLENGE_COMPLETE: "✓",
  BONUS: "✦",
}

export default function EarnScreen() {
  const theme = useTheme()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const { t } = useTranslation("common")
  const router = useRouter()

  const me = trpc.user.me.useQuery()
  const history = trpc.transaction.history.useQuery({ limit: 6 })

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const txs = history.data?.transactions ?? []

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.topRow}>
        <View>
          <Text style={[s.kicker, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>EARN</Text>
          <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("earnPoints", "Earn Points")}
          </Text>
        </View>
        {isRainbow ? (
          <VolumeGradient
            colors={["#8B3DFF", "#2B6EFF"]}
            shadowColor="#8B3DFF"
            shadowOpacity={0.40}
            borderRadius={43}
            style={s.balanceBubble}
          >
            <Text style={[s.balanceValue, { color: "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{total.toLocaleString()}</Text>
            <Text style={[s.balanceLabel, { color: "rgba(255,255,255,0.75)", fontFamily: fonts.bodyBold }]}>{t("pointsUnit")}</Text>
          </VolumeGradient>
        ) : (
          <View style={s.balanceBubble}>
            <Text style={[s.balanceValue, { fontFamily: fonts.displayHeavy }]}>{total.toLocaleString()}</Text>
            <Text style={[s.balanceLabel, { fontFamily: fonts.bodyBold }]}>{t("pointsUnit")}</Text>
          </View>
        )}
      </View>

      <LavaLampSurface intensity="glass" style={[s.hero, isRainbow ? {} : theme.shadowRaised]}>
        <View style={s.heroOrb} />
        <View style={s.heroHead}>
          <View style={s.blackLogo}>
            <Text style={[s.blackLogoText, isRainbow ? { color: "#8B3DFF" } : {}]}>P</Text>
          </View>
          <View style={s.blackPill}>
            <Text style={[s.blackPillText, { fontFamily: fonts.bodyBold }, isRainbow ? { color: "#44446A" } : {}]}>{t("activePlan")}</Text>
          </View>
        </View>
        <Text style={[s.heroTitle, { fontFamily: fonts.displayHeavy }, isRainbow ? { color: "#1A1A2E" } : {}]}>{t("earnMoreFromEveryVisit")}</Text>
        <Text style={[s.heroSub, { fontFamily: fonts.bodyBold }, isRainbow ? { color: "#44446A" } : {}]}>
          {t("partnersBeatScans", "Partners give up to 6× more than scanning")}
        </Text>
      </LavaLampSurface>

      <View style={s.methods}>
        <EarnMethod
          tone="cyan"
          icon="⌁"
          title={t("scanReceipt", "Scan Receipt")}
          sub={t("scanReceiptSub", "1pt / 500 RSD · any venue")}
          note={t("worksEverywhere", "Works everywhere")}
          onPress={() => router.push("/scan")}
          isRainbow={isRainbow}
        />
        <EarnMethod
          tone="black"
          icon="⌖"
          title={t("checkinPhoto", "Check-in Photo")}
          sub={t("checkinPhotoSub", "5 pts · with geolocation")}
          note={t("plusStreakBonus", "+ Streak bonus")}
          onPress={() => router.push("/checkin")}
          isRainbow={isRainbow}
        />
        <EarnMethod
          tone="white"
          icon="◦"
          title={t("stepCounter", "Step Counter")}
          sub={t("stepCounterSub", "+1.1-1.3× multiplier")}
          note={t("connectHealth", "Connect Health")}
          onPress={() => router.push("/steps")}
          isRainbow={isRainbow}
        />
        <EarnMethod
          tone="purple"
          icon="✦"
          title={t("partnerOffers", "Partner Offers")}
          sub={t("partnerOffersSub", "Scan QR at venue · earn bonus pts")}
          note={t("findOnMap", "Find on Map")}
          onPress={() => router.push("/map")}
          isRainbow={isRainbow}
        />
      </View>

      <View style={s.sectionRow}>
        <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
          {t("recentActivity", "Recent Activity")}
        </Text>
        <Pressable onPress={() => router.push("/points-history")}>
          <Text style={[s.seeAll, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
            {t("seeAll", "See all")} →
          </Text>
        </Pressable>
      </View>
      {txs.length === 0 ? (
        <NeuCard style={{ padding: 20, alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {t("noActivityYet", "No activity yet")}
          </Text>
        </NeuCard>
      ) : (
        <NeuCard style={s.activityCard}>
          {txs.map((tx, i) => {
            const isEarn = tx.pointsEarned > 0
            return (
              <View
                key={tx.id}
                style={[
                  s.txRow,
                  i < txs.length - 1 && { borderBottomColor: isRainbow ? "rgba(180,160,255,0.15)" : "rgba(5,6,10,0.07)", borderBottomWidth: 1 },
                ]}
              >
                <View style={[s.txIcon, isRainbow && s.txIconRainbow]}>
                  <Text style={[s.txIconText, { fontFamily: fonts.bodyBold }, isRainbow ? { color: neonColors.cyan } : {}]}>{TX_ICONS[tx.type] ?? "·"}</Text>
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
                    { color: isEarn ? (isRainbow ? neonColors.cyan : colors.ink) : "#D96AA7", fontFamily: fonts.displayHeavy },
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

const EARN_METHOD_RAINBOW: Record<string, readonly [string, string]> = {
  cyan:   ["#00F5FF", "#2B6EFF"],
  black:  ["#FF2D9B", "#8B3DFF"],
  white:  ["#8B3DFF", "#2B6EFF"],
  purple: ["#FF5500", "#8B3DFF"],
}

function EarnMethod({
  tone, icon, title, sub, note, onPress, isRainbow,
}: {
  tone: "cyan" | "black" | "white" | "purple"
  icon: string
  title: string
  sub: string
  note: string
  onPress: () => void
  isRainbow: boolean
}) {
  if (isRainbow) {
    const grad = EARN_METHOD_RAINBOW[tone]!
    return (
      <VolumeGradient
        colors={grad}
        shadowColor={grad[0]}
        shadowOpacity={0.38}
        borderRadius={32}
        onPress={onPress}
        style={s.methodCard}
      >
        <View style={s.methodCardContent}>
          <View style={[s.methodIcon, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
            <Text style={[s.methodIconText, { color: "rgba(255,255,255,0.95)" }]}>{icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.methodTitle, { color: "#FFFFFF", fontFamily: fonts.displayHeavy }]}>{title}</Text>
            <Text style={[s.methodSub, { color: "rgba(255,255,255,0.72)" }]}>{sub}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.methodNote, { color: "rgba(255,255,255,0.88)", fontFamily: fonts.bodyBold }]}>{note}</Text>
            <Text style={[s.methodArrow, { color: "rgba(255,255,255,0.9)" }]}>↗</Text>
          </View>
        </View>
      </VolumeGradient>
    )
  }

  const dark = tone === "black"
  const bg = tone === "cyan" ? "rgba(235,254,255,0.92)" : dark ? "rgba(255,244,254,0.92)" : tone === "purple" ? "rgba(245,236,255,0.92)" : "#F9FBFF"
  const fg = colors.ink
  const content = (
    <>
      <View style={[s.methodIcon, { backgroundColor: "rgba(255,255,255,0.72)" }]}>
        <Text style={[s.methodIconText, { color: dark ? "#B0D4E3" : "#91A1B4" }]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.methodTitle, { color: fg, fontFamily: fonts.displayHeavy }]}>{title}</Text>
        <Text style={[s.methodSub, { color: "#91A1B4" }]}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.methodNote, { color: colors.ink, fontFamily: fonts.bodyBold }]}>{note}</Text>
        <Text style={[s.methodArrow, { color: fg }]}>↗</Text>
      </View>
    </>
  )

  if (dark) {
    return (
      <Pressable onPress={onPress}>
        <LavaLampSurface intensity="glass" style={s.methodCard} contentStyle={s.methodCardContent}>
          {content}
        </LavaLampSurface>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={[s.methodCard, { backgroundColor: bg }]}>
      {content}
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  kicker: { fontSize: 11, letterSpacing: 1.8 },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: 0 },
  balanceBubble: { width: 86, height: 86, borderRadius: 43, backgroundColor: "#F9FBFF", alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.34, shadowRadius: 12, elevation: 3 },
  balanceValue: { color: colors.ink, fontSize: 25, lineHeight: 27 },
  balanceLabel: { color: "#7A808E", fontSize: 11 },
  hero: { borderRadius: 32, padding: 18, minHeight: 214, marginBottom: 12, overflow: "hidden" },
  heroOrb: { position: "absolute", right: -52, top: -42, width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: "rgba(167,232,238,0.32)" },
  heroHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 34 },
  blackLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.86)" },
  blackLogoText: { color: "#91A1B4", fontWeight: "900" },
  blackPill: { backgroundColor: "rgba(255,255,255,0.58)", borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9 },
  blackPillText: { color: "#91A1B4", fontSize: 12 },
  heroTitle: { color: "#6E7D8E", fontSize: 31, lineHeight: 34, width: 250 },
  heroSub: { color: "#91A1B4", fontSize: 13, marginTop: 10 },
  methods: { gap: 10, marginBottom: 24 },
  methodCard: { borderRadius: 32, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 3 },
  methodCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  methodIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  methodIconText: { fontSize: 18, fontWeight: "900" },
  methodTitle: { fontSize: 19, lineHeight: 22 },
  methodSub: { fontSize: 12, marginTop: 3 },
  methodNote: { fontSize: 10, maxWidth: 82, textAlign: "right" },
  methodArrow: { fontSize: 22, marginTop: 4 },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 25 },
  seeAll: { fontSize: 12 },
  activityCard: { padding: 0 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  txIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cyan, alignItems: "center", justifyContent: "center" },
  txIconRainbow: { backgroundColor: "rgba(0,245,255,0.15)" },
  txIconText: { color: colors.ink, fontSize: 14 },
  txTitle: { fontSize: 14 },
  txDate: { fontSize: 11, marginTop: 1 },
  txValue: { fontSize: 17 },
})
