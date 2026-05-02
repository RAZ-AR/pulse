import { useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import QRCode from "react-native-qrcode-svg"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

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
    onError: (e) => Alert.alert(t("redeemFailed", "Redeem failed"), e.message),
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
      <Stack.Screen options={{ headerShown: true, title: t("title", "Reward"), headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.text }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {redemption ? (
          <View style={s.successBlock}>
            <Text style={[s.successTitle, { color: theme.text }]}>{t("redeemSuccess", "Reward redeemed!")}</Text>
            <Text style={[s.successDesc, { color: theme.textSecondary }]}>
              {t("redeemSuccessDescription", "Show this code to the cashier")}
            </Text>
            <View style={[s.qrBox, { backgroundColor: "#FFF" }]}>
              <QRCode value={redemption.code} size={220} />
            </View>
            <Text style={[s.code, { color: theme.text }]}>{redemption.code}</Text>
            <Text style={[s.expiry, { color: theme.textSecondary }]}>
              {t("codeExpiresIn", "Code expires in {{hours}}h", { hours: expiryHours })}
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={[s.btn, { backgroundColor: theme.text }]}
            >
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("common:done", "Done")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[s.title, { color: theme.text }]}>{reward.title}</Text>
            <Text style={[s.venue, { color: theme.textSecondary }]}>
              {reward.venue.name} · {reward.venue.city}
            </Text>

            <View style={[s.priceCard, { backgroundColor: colors.pink }]}>
              <Text style={s.priceLabel}>{t("pointsCost", "{{points}} pts", { points: "" }).replace(/\s+pts$/, "").toUpperCase()}</Text>
              <Text style={s.priceValue}>{reward.pointsCost}</Text>
              <Text style={s.priceSub}>
                {t("yourBalance", "Your balance")}: {totalPoints}
              </Text>
            </View>

            {reward.description ? (
              <View style={[s.descCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.descText, { color: theme.text }]}>{reward.description}</Text>
              </View>
            ) : null}

            {stockLeft !== null ? (
              <Text style={[s.stock, { color: theme.textSecondary }]}>
                {stockLeft > 0
                  ? t("stockLeft", "{{count}} left", { count: stockLeft })
                  : t("outOfStock", "Out of stock")}
              </Text>
            ) : null}

            <Pressable
              onPress={() => redeem.mutate({ rewardId: reward.id })}
              disabled={!canRedeem || redeem.isPending}
              style={[
                s.btn,
                {
                  backgroundColor: canRedeem ? theme.text : theme.surface,
                  borderWidth: canRedeem ? 0 : 1,
                  borderColor: theme.border,
                  opacity: redeem.isPending ? 0.5 : 1,
                },
              ]}
            >
              <Text style={{ color: canRedeem ? theme.bg : theme.textSecondary, fontWeight: "700", fontSize: 15 }}>
                {redeem.isPending
                  ? t("redeeming", "Redeeming…")
                  : !canRedeem
                  ? totalPoints < reward.pointsCost
                    ? t("notEnoughPoints", "Not enough points")
                    : t("unavailable", "Unavailable")
                  : t("redeemFor", "Redeem for {{points}} pts", { points: reward.pointsCost })}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800" },
  venue: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  priceCard: { padding: 20, borderRadius: 14, alignItems: "center", marginBottom: 16 },
  priceLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, opacity: 0.85 },
  priceValue: { color: "#FFF", fontSize: 44, fontWeight: "800", marginTop: 2 },
  priceSub: { color: "#FFF", fontSize: 12, marginTop: 4, opacity: 0.85 },
  descCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  descText: { fontSize: 14, lineHeight: 20 },
  stock: { fontSize: 12, marginBottom: 12 },
  btn: { padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  successBlock: { alignItems: "center", paddingTop: 20 },
  successTitle: { fontSize: 22, fontWeight: "800" },
  successDesc: { fontSize: 13, marginTop: 4, marginBottom: 24, textAlign: "center" },
  qrBox: { padding: 20, borderRadius: 14, marginBottom: 16 },
  code: { fontSize: 18, fontWeight: "700", letterSpacing: 3, fontFamily: "monospace", marginBottom: 8 },
  expiry: { fontSize: 12, marginBottom: 24 },
})
