import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"
import { REFERRAL_REWARD_POINTS, REFERRAL_SIGNUP_POINTS } from "@pulse/shared"

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

export default function ReferralsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("profile")

  const me = trpc.user.me.useQuery()
  const referrals = trpc.user.getReferrals.useQuery()

  const code = me.data?.referralCode ?? ""

  async function share() {
    if (!code) return
    try {
      await Share.share({
        message: t("shareMessage", "Join me on PULSE — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: pulse.app/r/{{code}}", { code }),
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
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.pink }]}>
          <Text style={s.heroLabel}>{t("friendsReferred", "FRIENDS REFERRED")}</Text>
          <Text style={s.heroValue}>{list.length}</Text>
          <Text style={s.heroSub}>
            {onboardedCount} {t("active", "active")}
          </Text>
        </View>

        {/* How it works */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>{t("howItWorks", "How it works")}</Text>
          <Text style={[s.cardLine, { color: theme.textSecondary }]}>
            1. {t("step1", "Share your code with a friend")}
          </Text>
          <Text style={[s.cardLine, { color: theme.textSecondary }]}>
            2. {t("step2", "They sign up and get +{{pts}} bonus", { pts: REFERRAL_SIGNUP_POINTS })}
          </Text>
          <Text style={[s.cardLine, { color: theme.textSecondary }]}>
            3. {t("step3", "You get +{{pts}} when they make their first partner purchase", { pts: REFERRAL_REWARD_POINTS })}
          </Text>
        </View>

        {/* Code + share */}
        {code ? (
          <View style={[s.codeCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.codeLabel, { color: theme.textSecondary }]}>
                {t("yourCode", "Your code").toUpperCase()}
              </Text>
              <Text style={[s.codeValue, { color: theme.text }]}>{code}</Text>
            </View>
            <Pressable onPress={share} style={[s.shareBtn, { backgroundColor: theme.text }]}>
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("share", "Share")}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Friends list */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          {t("referredFriends", "Referred friends").toUpperCase()}
        </Text>
        {list.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={s.emptyEmoji}>🤝</Text>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {t("noReferralsYet", "No referrals yet. Share your code to get started!")}
            </Text>
          </View>
        ) : (
          <View style={[s.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {list.map((r, i) => (
              <View
                key={r.id}
                style={[s.row, i < list.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              >
                <View style={s.rowLeft}>
                  <View style={[s.avatar, { backgroundColor: theme.bg }]}>
                    <Text style={[s.avatarLetter, { color: theme.text }]}>
                      {(r.name?.[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
                      {r.name ?? t("unnamedUser", "New user")}
                    </Text>
                    <Text style={[s.date, { color: theme.textSecondary }]}>
                      {t("joined", "Joined")} {formatDate(r.createdAt)}
                    </Text>
                  </View>
                </View>
                {r.onboardingDone ? (
                  <Text style={[s.statusActive, { color: colors.mint }]}>{t("active", "active")}</Text>
                ) : (
                  <Text style={[s.statusPending, { color: theme.textSecondary }]}>
                    {t("pendingOnboarding", "pending")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  hero: { borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 16 },
  heroLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, opacity: 0.85 },
  heroValue: { color: "#FFF", fontSize: 56, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "#FFF", fontSize: 13, marginTop: 4, opacity: 0.85 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  cardLine: { fontSize: 13, lineHeight: 20 },
  codeCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  codeLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  codeValue: { fontSize: 22, fontWeight: "800", letterSpacing: 4, fontFamily: "monospace", marginTop: 2 },
  shareBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  empty: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: "center" },
  list: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  avatarLetter: { fontSize: 14, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "600" },
  date: { fontSize: 11, marginTop: 2 },
  statusActive: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  statusPending: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
})
