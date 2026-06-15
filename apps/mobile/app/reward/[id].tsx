import { useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import QRCode from "react-native-qrcode-svg"
import { trpc } from "../../src/lib/trpc"
import { fonts, useTheme } from "../../src/lib/theme"

// ── Device (Teenage-Engineering) tokens ──
const ORANGE = "#f2a66e"
const ORANGE_EDGE = "#D98A4E"
const GREEN = "#3E8E6E"
const INK = "#33322D"
const DIM = "#8C887E"
const CREAM = "#EDEDEB"
const LCD = "#DBDBD7"
const LCD_EDGE = "#C4C4BE"
const LCD_INK = "#3A3F42"
const EDGE = "rgba(110,102,86,0.18)"
const HILITE = "rgba(255,255,255,0.95)"

export default function RewardDetailScreen() {
  const theme = useTheme()
  const { t } = useTranslation("rewards")
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const utils = trpc.useUtils()

  const me = trpc.user.me.useQuery()
  const rewards = trpc.reward.list.useQuery({ limit: 100 })
  const reward = rewards.data?.rewards.find((r) => r.id === id)

  const [redemption, setRedemption] = useState<{ code: string; expiresAt: Date } | null>(null)
  const redeem = trpc.reward.redeem.useMutation({
    onSuccess: (data) => {
      setRedemption({ code: data.redemptionCode, expiresAt: new Date(data.expiresAt) })
      utils.user.me.invalidate()
      utils.reward.list.invalidate()
    },
    onError: (e) => Alert.alert(t("redeemFailed"), e.message),
  })

  if (!reward) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("common:loading", "Loading…")}</Text>
      </View>
    )
  }

  const totalPoints = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const canRedeem = totalPoints >= reward.pointsCost && reward.isActive
  const stockLeft = reward.stockLimit !== null ? reward.stockLimit - reward.redeemedCount : null
  const expiryHours = redemption ? Math.max(0, Math.round((redemption.expiresAt.getTime() - Date.now()) / 3_600_000)) : 0

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("title", "Reward"),
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {redemption ? (
          <View style={{ alignItems: "center" }}>
            <Text style={[s.successTitle, { color: GREEN, fontFamily: fonts.displayHeavy }]}>{t("redeemSuccess", "Reward redeemed!")}</Text>
            <Text style={[s.successDesc, { color: DIM }]}>{t("redeemSuccessDescription", "Show this code to the cashier")}</Text>
            <View style={s.qrBox}>
              <QRCode value={redemption.code} size={200} backgroundColor="#FFFFFF" color="#1F2937" />
            </View>
            <Text style={[s.code, { color: LCD_INK, fontFamily: fonts.pixel }]}>{redemption.code}</Text>
            <Text style={[s.expiry, { color: DIM, fontFamily: fonts.pixel }]}>
              {t("codeExpiresIn", "Code expires in {{hours}}h", { hours: expiryHours })}
            </Text>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.keyPressed]}>
              <Text style={[s.cta, { fontFamily: fonts.displayHeavy, color: "#FFFFFF" }]}>{t("common:done", "Done")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[s.title, { color: INK, fontFamily: fonts.displayHeavy }]}>{reward.title}</Text>
            <Text style={[s.venue, { color: DIM }]}>{reward.venue.name} · {reward.venue.city}</Text>

            {/* Price — recessed LCD plate */}
            <View style={s.priceCard}>
              <Text style={[s.priceLabel, { fontFamily: fonts.pixel }]}>{t("pointsCostLabel").toUpperCase()}</Text>
              <Text style={[s.priceValue, { fontFamily: fonts.pixel }]}>{reward.pointsCost}</Text>
              <Text style={[s.priceSub, { fontFamily: fonts.pixel }]}>{t("yourBalance").toUpperCase()}: {totalPoints}</Text>
            </View>

            {reward.description ? (
              <View style={s.descCard}>
                <Text style={[s.descText, { color: INK }]}>{reward.description}</Text>
              </View>
            ) : null}

            {stockLeft !== null ? (
              <Text style={[s.stock, { color: DIM, fontFamily: fonts.pixel }]}>
                {stockLeft > 0 ? t("stockLeft", { count: stockLeft }) : t("outOfStock", "Out of stock")}
              </Text>
            ) : null}

            {canRedeem ? (
              <Pressable
                onPress={() => redeem.mutate({ rewardId: reward.id })}
                disabled={redeem.isPending}
                style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.keyPressed]}
              >
                <Text style={[s.cta, { fontFamily: fonts.displayHeavy, color: "#FFFFFF" }]}>
                  {redeem.isPending ? t("redeeming") : t("redeemFor", { points: reward.pointsCost })}
                </Text>
              </Pressable>
            ) : (
              <View style={[s.btn, s.btnDisabled]}>
                <Text style={[s.ctaDisabled, { color: DIM, fontFamily: fonts.bodyBold }]}>
                  {totalPoints < reward.pointsCost ? t("notEnoughPoints", "Not enough points") : t("unavailable")}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  title: { fontSize: 30, lineHeight: 34, color: INK },
  venue: { fontSize: 13, marginTop: 6, marginBottom: 18 },

  priceCard: {
    backgroundColor: LCD, borderWidth: 2, borderColor: LCD_EDGE,
    padding: 22, alignItems: "center", marginBottom: 16, borderRadius: 16,
  },
  priceLabel: { color: DIM, fontSize: 7, letterSpacing: 0.5 },
  priceValue: { color: LCD_INK, fontSize: 40, lineHeight: 46, marginTop: 8 },
  priceSub: { color: DIM, fontSize: 7, marginTop: 8, letterSpacing: 0.5 },

  descCard: {
    backgroundColor: CREAM, borderRadius: 16, padding: 16, marginBottom: 16,
    borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 4, borderBottomColor: EDGE,
  },
  descText: { fontSize: 14, lineHeight: 20 },

  stock: { fontSize: 7, marginBottom: 12, letterSpacing: 0.5 },

  btn: {
    padding: 16, alignItems: "center", borderRadius: 16, width: "100%", marginTop: 12,
    borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 5, borderBottomColor: EDGE,
    shadowColor: "#9A958A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 5,
  },
  btnPrimary: { backgroundColor: ORANGE, borderBottomColor: ORANGE_EDGE, borderTopColor: "rgba(255,255,255,0.5)" },
  btnDisabled: { backgroundColor: "#E4E3DF" },
  keyPressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }] },
  cta: { fontSize: 16 },
  ctaDisabled: { fontSize: 14 },

  successTitle: { fontSize: 22 },
  successDesc: { fontSize: 13, marginTop: 4, marginBottom: 24, textAlign: "center" },
  qrBox: { padding: 16, marginBottom: 16, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: LCD_EDGE },
  code: { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  expiry: { fontSize: 8, marginBottom: 12, letterSpacing: 0.5 },
})
