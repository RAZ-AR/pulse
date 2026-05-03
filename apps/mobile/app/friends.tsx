import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"

const TYPE_ICON: Record<string, string> = {
  CHECKIN_PHOTO: "📍",
  CHALLENGE_COMPLETE: "🎯",
  REWARD_REDEEMED: "🎁",
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
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Friends row */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          {t("yourFriends", "Your friends").toUpperCase()}
        </Text>
        {friendsList.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={s.emptyEmoji}>🤝</Text>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {t("noFriendsYet", "Invite friends with your referral code to see their activity here")}
            </Text>
            <Pressable
              onPress={() => router.push("/referrals")}
              style={[s.btn, { backgroundColor: theme.text }]}
            >
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("inviteFriends", "Invite friends")}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friendsRow}>
            {friendsList.map((f) => (
              <View key={f.id} style={s.friend}>
                <View style={[s.avatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[s.avatarLetter, { color: theme.text }]}>
                    {(f.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.friendName, { color: theme.text }]} numberOfLines={1}>
                  {f.name ?? "User"}
                </Text>
                <Text style={[s.friendStreak, { color: colors.pink }]}>🔥 {f.currentStreak}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Feed */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, marginTop: 24 }]}>
          {t("recentActivity", "Recent activity").toUpperCase()}
        </Text>
        {feedItems.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={s.emptyEmoji}>👀</Text>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {friendsList.length === 0
                ? t("addFriendsToSeeFeed", "Once you have friends, you'll see their check-ins, completed challenges, and rewards here.")
                : t("noActivityYet", "No recent activity from your friends in the last 14 days.")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {feedItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => item.venue && router.push({ pathname: "/venue/[id]", params: { id: item.venue.id } })}
                style={[s.feedRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[s.avatar, s.avatarSm, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[s.avatarLetterSm, { color: theme.text }]}>
                    {(item.user.name?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.feedText, { color: theme.text }]} numberOfLines={2}>
                    <Text style={{ fontWeight: "700" }}>{item.user.name ?? "Someone"}</Text>{" "}
                    {actionText(item.type, item.venue?.name, t)}
                  </Text>
                  <Text style={[s.feedTime, { color: theme.textSecondary }]}>
                    {formatRelative(item.createdAt)}
                    {item.pointsEarned > 0 ? `  ·  +${item.pointsEarned} pts` : ""}
                  </Text>
                </View>
                <Text style={s.feedIcon}>{TYPE_ICON[item.type] ?? "•"}</Text>
              </Pressable>
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
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 12 },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  friendsRow: { gap: 12, paddingVertical: 4, paddingHorizontal: 4 },
  friend: { width: 64, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  avatarSm: { width: 36, height: 36, borderRadius: 18 },
  avatarLetter: { fontSize: 22, fontWeight: "800" },
  avatarLetterSm: { fontSize: 13, fontWeight: "800" },
  friendName: { fontSize: 11, fontWeight: "600", marginTop: 6, textAlign: "center" },
  friendStreak: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  feedText: { fontSize: 13, lineHeight: 18 },
  feedTime: { fontSize: 11, marginTop: 2 },
  feedIcon: { fontSize: 22 },
})
