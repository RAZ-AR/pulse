import { useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import QRCode from "react-native-qrcode-svg"
import { trpc } from "../../src/lib/trpc"
import { fonts, gradients, useTheme } from "../../src/lib/theme"
import { NeuCard } from "../../src/components/neu"

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
      <Stack.Screen options={{
        headerShown: true,
        title: t("title", "Reward"),
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {redemption ? (
          <View style={{ alignItems: "center" }}>
            <Text style={[s.successTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
              {t("redeemSuccess", "Reward redeemed!")}
            </Text>
            <Text style={[s.successDesc, { color: theme.textSecondary }]}>
              {t("redeemSuccessDescription", "Show this code to the cashier")}
            </Text>
            <NeuCard style={s.qrBox}>
              <QRCode value={redemption.code} size={220} backgroundColor="#FFFFFF" />
            </NeuCard>
            <Text style={[s.code, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{redemption.code}</Text>
            <Text style={[s.expiry, { color: theme.textSecondary }]}>
              {t("codeExpiresIn", "Code expires in {{hours}}h", { hours: expiryHours })}
            </Text>
            <NeuCard
              gradient={gradients.rainbow}
              onPress={() => router.back()}
              style={{ padding: 16, alignItems: "center", width: "100%", marginTop: 12 }}
            >
              <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("common:done", "Done")}</Text>
            </NeuCard>
          </View>
        ) : (
          <>
            <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{reward.title}</Text>
            <Text style={[s.venue, { color: theme.textSecondary }]}>
              {reward.venue.name} · {reward.venue.city}
            </Text>

            <NeuCard gradient={gradients.rainbow} style={s.priceCard}>
              <View style={s.priceBlob} />
              <Text style={[s.priceLabel, { fontFamily: fonts.bodyBold }]}>
                {t("pointsCost", "Points cost").toUpperCase()}
              </Text>
              <Text style={[s.priceValue, { fontFamily: fonts.displayHeavy }]}>{reward.pointsCost}</Text>
              <Text style={s.priceSub}>
                {t("yourBalance", "Your balance")}: {totalPoints}
              </Text>
            </NeuCard>

            {reward.description ? (
              <NeuCard style={{ padding: 16, marginBottom: 16 }}>
                <Text style={[s.descText, { color: theme.text }]}>{reward.description}</Text>
              </NeuCard>
            ) : null}

            {stockLeft !== null ? (
              <Text style={[s.stock, { color: theme.textSecondary }]}>
                {stockLeft > 0
                  ? t("stockLeft", "{{count}} left", { count: stockLeft })
                  : t("outOfStock", "Out of stock")}
              </Text>
            ) : null}

            {canRedeem ? (
              <NeuCard
                gradient={gradients.rainbow}
                onPress={() => redeem.mutate({ rewardId: reward.id })}
                disabled={redeem.isPending}
                style={s.btnGrad}
              >
                <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>
                  {redeem.isPending ? t("redeeming", "Redeeming…") : t("redeemFor", "Redeem for {{points}} pts", { points: reward.pointsCost })}
                </Text>
              </NeuCard>
            ) : (
              <Pressable disabled style={[s.btnDisabled, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}>
                <Text style={[s.ctaDisabled, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                  {totalPoints < reward.pointsCost
                    ? t("notEnoughPoints", "Not enough points")
                    : t("unavailable", "Unavailable")}
                </Text>
              </Pressable>
            )}
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

  title: { fontSize: 24 },
  venue: { fontSize: 13, marginTop: 4, marginBottom: 20 },

  priceCard: { padding: 24, alignItems: "center", marginBottom: 16, overflow: "hidden" },
  priceBlob: { position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.12)" },
  priceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, letterSpacing: 1.5 },
  priceValue: { color: "#FFF", fontSize: 52, lineHeight: 56, marginTop: 4, textShadowColor: "rgba(0,0,0,0.12)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  priceSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 },

  descText: { fontSize: 14, lineHeight: 20 },

  stock: { fontSize: 12, marginBottom: 12 },

  btnGrad: { padding: 16, alignItems: "center" },
  btnDisabled: { padding: 16, borderRadius: 22, alignItems: "center" },
  cta: { color: "#FFF", fontSize: 16, textShadowColor: "rgba(0,0,0,0.15)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  ctaDisabled: { fontSize: 14 },

  successTitle: { fontSize: 22 },
  successDesc: { fontSize: 13, marginTop: 4, marginBottom: 24, textAlign: "center" },
  qrBox: { padding: 20, marginBottom: 16, backgroundColor: "#FFFFFF" },
  code: { fontSize: 18, letterSpacing: 3, marginBottom: 8 },
  expiry: { fontSize: 12, marginBottom: 12 },
})
