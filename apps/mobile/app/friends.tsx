import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, neonColors, fonts, gradients, useTheme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { NeuCard } from "../src/components/neu"

const TYPE_ICON: Record<string, string> = {
  CHECKIN_PHOTO: "⌖",
  CHALLENGE_COMPLETE: "✓",
  REWARD_REDEEMED: "□",
}

function formatRelative(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function actionText(type: string, venueName: string | null | undefined, t: (k: string, fallback: string) => string): string {
  if (type === "CHECKIN_PHOTO") return `${t("checkedInAt", "checked in at")} ${venueName ?? "a venue"}`
  if (type === "CHALLENGE_COMPLETE") return t("completedChallenge", "completed a challenge")
  if (type === "REWARD_REDEEMED") return `${t("redeemedAt", "redeemed a reward at")} ${venueName ?? "a venue"}`
  return type
}

export default function FriendsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const router = useRouter()

  const friends = trpc.social.friends.useQuery()
  const feed = trpc.social.feed.useQuery({ limit: 30 })

  const friendsList = friends.data ?? []
  const feedItems = feed.data?.items ?? []

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("nav.friends", "Friends"),
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Friends row */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("yourFriends", "Your friends").toUpperCase()}
        </Text>
        {friendsList.length === 0 ? (
          <NeuCard style={{ padding: 24, alignItems: "center", marginBottom: 24 }}>
            <Text style={s.emptyIcon}>+</Text>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {t("noFriendsYet", "Invite friends with your referral code to see their activity here")}
            </Text>
            <NeuCard
              gradient={gradients.black}
              onPress={() => router.push("/referrals")}
              small
              style={{ paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 }}
            >
              <Text style={[s.inviteText, { fontFamily: fonts.bodyBold }]}>{t("inviteFriends", "Invite friends")}</Text>
            </NeuCard>
          </NeuCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friendsRow}>
            {friendsList.map((f) => (
              <View key={f.id} style={s.friend}>
                <View style={[s.friendAvatar, { backgroundColor: isRainbow ? "#F2F2F6" : theme.bg }, theme.shadowRaisedSm]}>
                  <Text style={[s.friendLetter, { color: isRainbow ? neonColors.cyan : theme.text, fontFamily: fonts.displayHeavy }]}>
                    {(f.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.friendName, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                  {f.name ?? "User"}
                </Text>
                <Text style={[s.friendStreak, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.green : colors.ink }]}>{f.currentStreak}d</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Feed */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, marginTop: 24, fontFamily: fonts.bodyBold }]}>
          {t("recentActivity", "Recent activity").toUpperCase()}
        </Text>
        {feedItems.length === 0 ? (
          <NeuCard style={{ padding: 24, alignItems: "center" }}>
            <Text style={s.emptyIcon}>◦</Text>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {friendsList.length === 0
                ? t("addFriendsToSeeFeed", "Once you have friends, you'll see their check-ins, completed challenges, and rewards here.")
                : t("noActivityYet", "No recent activity from your friends in the last 14 days.")}
            </Text>
          </NeuCard>
        ) : (
          <View style={{ gap: 8 }}>
            {feedItems.map((item) => (
              <NeuCard
                key={item.id}
                onPress={item.venue ? () => router.push({ pathname: "/venue/[id]", params: { id: item.venue!.id } }) : undefined}
                style={s.feedRow}
              >
                <View style={[s.feedAvatar, { backgroundColor: isRainbow ? "#F2F2F6" : theme.bg }, theme.shadowRaisedSm]}>
                  <Text style={[s.feedLetter, { color: isRainbow ? neonColors.purple : theme.text, fontFamily: fonts.displayHeavy }]}>
                    {(item.user.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.feedText, { color: theme.text }]} numberOfLines={2}>
                    <Text style={{ fontFamily: fonts.bodyBold }}>{item.user.name ?? "Someone"}</Text>{" "}
                    {actionText(item.type, item.venue?.name, t)}
                  </Text>
                  <Text style={[s.feedTime, { color: theme.textSecondary }]}>
                    {formatRelative(item.createdAt)}
                    {item.pointsEarned > 0 ? `  ·  +${item.pointsEarned} pts` : ""}
                  </Text>
                </View>
                <Text style={[s.feedIcon, { color: isRainbow ? neonColors.pink : colors.ink }]}>{TYPE_ICON[item.type] ?? "•"}</Text>
              </NeuCard>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },

  emptyIcon: { color: colors.ink, fontSize: 42, lineHeight: 46, fontWeight: "900", marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  inviteText: { color: colors.ink, fontSize: 13 },

  friendsRow: { gap: 14, paddingVertical: 8, paddingHorizontal: 4 },
  friend: { width: 64, alignItems: "center" },
  friendAvatar: { width: 56, height: 56, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  friendLetter: { fontSize: 22 },
  friendName: { fontSize: 11, marginTop: 6, textAlign: "center" },
  friendStreak: { fontSize: 11, color: colors.ink, marginTop: 2 },

  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 28 },
  feedAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  feedLetter: { fontSize: 14 },
  feedText: { fontSize: 13, lineHeight: 18 },
  feedTime: { fontSize: 11, marginTop: 2 },
  feedIcon: { color: colors.ink, fontSize: 22, fontWeight: "900" },
})
