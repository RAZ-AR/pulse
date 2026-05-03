import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

export default function EarnScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const me = trpc.user.me.useQuery()

  const totalPoints = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={[s.balance, { backgroundColor: colors.pink }]}>
        <Text style={s.balanceLabel}>{t("pointsBalance", "Points balance")}</Text>
        <Text style={s.balanceValue}>{totalPoints.toLocaleString()}</Text>
      </View>

      <Text style={[s.title, { color: theme.text }]}>{t("howToEarn", "How to earn points")}</Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        {t("earnDescription", "Pick a way to earn — partners reward higher rates than receipts")}
      </Text>

      <View style={s.actions}>
        <ActionCard
          icon="📷"
          title={t("scanReceipt", "Scan receipt")}
          subtitle={t("scanReceiptDesc", "Get points for any restaurant or shop receipt")}
          color={colors.pink}
          onPress={() => router.push("/scan")}
        />
        <ActionCard
          icon="📍"
          title={t("checkinPhoto", "Check-in photo")}
          subtitle={t("checkinPhotoDesc", "Take a photo at a venue to earn streak points")}
          color={colors.sky}
          onPress={() => router.push("/checkin")}
        />
        <ActionCard
          icon="👟"
          title={t("steps", "Steps")}
          subtitle={t("stepsDesc", "Sync HealthKit/Google Fit for earn multipliers")}
          color={colors.mint}
          onPress={() => router.push("/steps")}
        />
      </View>
    </ScrollView>
  )
}

function ActionCard({
  icon, title, subtitle, color, onPress,
}: { icon: string; title: string; subtitle: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.card, { backgroundColor: color }]}>
      <Text style={s.cardIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={s.cardArrow}>→</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  balance: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 24 },
  balanceLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", opacity: 0.85 },
  balanceValue: { color: "#FFF", fontSize: 32, fontWeight: "800", marginTop: 2 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 20 },
  actions: { gap: 12 },
  card: { padding: 18, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  cardIcon: { fontSize: 32 },
  cardTitle: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  cardSubtitle: { color: "#FFF", fontSize: 12, opacity: 0.9, marginTop: 2 },
  cardArrow: { color: "#FFF", fontSize: 20, fontWeight: "700" },
})
