import { ScrollView, Share, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, neonColors, fonts, gradients, useTheme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { NeuCard } from "../src/components/neu"
import { REFERRAL_REWARD_POINTS, REFERRAL_SIGNUP_POINTS } from "@pulse/shared"

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

export default function ReferralsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("profile")
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"

  const me = trpc.user.me.useQuery()
  const referrals = trpc.user.getReferrals.useQuery()

  const code = me.data?.referralCode ?? ""

  async function share() {
    if (!code) return
    try {
      await Share.share({
        message: t(
          "shareMessage",
          "Join me on ayoo — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: ayoo.app/r/{{code}}",
          { code },
        ),
      })
    } catch { /* cancelled */ }
  }

  const list = referrals.data ?? []
  const onboardedCount = list.filter((r) => r.onboardingDone).length

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("yourReferrals", "Your referrals"),
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <NeuCard gradient={gradients.black} style={s.hero}>
          <View style={s.heroBlob} />
          <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>{t("friendsReferred", "FRIENDS REFERRED")}</Text>
          <Text style={[s.heroValue, { fontFamily: fonts.displayHeavy }]}>{list.length}</Text>
          <Text style={s.heroSub}>
            {onboardedCount} {t("active", "active")}
          </Text>
        </NeuCard>

        {/* How it works */}
        <NeuCard style={{ padding: 16, marginBottom: 16 }}>
          <Text style={[s.h2, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("howItWorks", "How it works")}
          </Text>
          <Text style={[s.line, { color: theme.textSecondary }]}>
            1. {t("step1", "Share your code with a friend")}
          </Text>
          <Text style={[s.line, { color: theme.textSecondary }]}>
            2. {t("step2", "They sign up and get +{{pts}} bonus", { pts: REFERRAL_SIGNUP_POINTS })}
          </Text>
          <Text style={[s.line, { color: theme.textSecondary }]}>
            3. {t("step3", "You get +{{pts}} when they make their first partner purchase", { pts: REFERRAL_REWARD_POINTS })}
          </Text>
        </NeuCard>

        {/* Code + share */}
        {code ? (
          <NeuCard gradient={gradients.black} style={s.codeCard}>
            <View>
              <Text style={[s.codeLabel, { fontFamily: fonts.bodyBold }]}>
                {t("yourCode", "Your code").toUpperCase()}
              </Text>
              <Text style={[s.codeValue, { fontFamily: fonts.displayHeavy }]}>{code}</Text>
            </View>
            <NeuCard
              onPress={share}
              gradient={gradients.pearl}
              small
              style={{ paddingHorizontal: 18, paddingVertical: 10 }}
            >
              <Text style={[s.shareBtnText, { fontFamily: fonts.bodyBold }]}>{t("share", "Share")} ↗</Text>
            </NeuCard>
          </NeuCard>
        ) : null}

        {/* Friends list */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("referredFriends", "Referred friends").toUpperCase()}
        </Text>
        {list.length === 0 ? (
          <NeuCard style={{ padding: 24, alignItems: "center" }}>
            <Text style={s.emptyIcon}>+</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
              {t("noReferralsYet", "No referrals yet. Share your code to get started!")}
            </Text>
          </NeuCard>
        ) : (
          <NeuCard style={{ padding: 0 }}>
            {list.map((r, i) => (
              <View
                key={r.id}
                style={[
                  s.row,
                  i < list.length - 1 && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 },
                ]}
              >
                <View style={[s.avatar, { backgroundColor: isRainbow ? "#F2F2F6" : theme.bg }, theme.shadowRaisedSm]}>
                  <Text style={[s.avatarLetter, { color: isRainbow ? neonColors.cyan : theme.text, fontFamily: fonts.displayHeavy }]}>
                    {(r.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.name, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {r.name ?? t("unnamedUser", "New user")}
                  </Text>
                  <Text style={[s.date, { color: theme.textSecondary }]}>
                    {t("joined", "Joined")} {formatDate(r.createdAt)}
                  </Text>
                </View>
                {r.onboardingDone ? (
                  <Text style={[s.statusActive, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.green : colors.ink }]}>{t("active", "active")}</Text>
                ) : (
                  <Text style={[s.statusPending, { color: theme.textSecondary }]}>
                    {t("pendingOnboarding", "pending")}
                  </Text>
                )}
              </View>
            ))}
          </NeuCard>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },

  hero: { padding: 20, alignItems: "center", marginBottom: 16, overflow: "hidden", borderRadius: 32 },
  heroBlob: { position: "absolute", top: -42, right: -42, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  heroLabel: { color: "#91A1B4", fontSize: 11, letterSpacing: 1.5 },
  heroValue: { color: colors.ink, fontSize: 56, lineHeight: 60, marginTop: 4 },
  heroSub: { color: "#91A1B4", fontSize: 13 },

  h2: { fontSize: 22, marginBottom: 8 },
  line: { fontSize: 13, lineHeight: 20 },

  codeCard: { padding: 16, marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 30 },
  codeLabel: { color: "#91A1B4", fontSize: 10, letterSpacing: 1 },
  codeValue: { color: colors.ink, fontSize: 22, letterSpacing: 4, marginTop: 2 },
  shareBtnText: { color: colors.ink, fontSize: 13 },

  sectionTitle: { fontSize: 11, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  emptyIcon: { color: colors.ink, fontSize: 42, lineHeight: 46, fontWeight: "900", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 14 },
  name: { fontSize: 14 },
  date: { fontSize: 11, marginTop: 2 },
  statusActive: { fontSize: 11, color: colors.ink, letterSpacing: 0.5 },
  statusPending: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
})
