import { useState } from "react"
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { useTheme, colors } from "../../src/lib/theme"
import { trpc } from "../../src/lib/trpc"
import { useAuth } from "../../src/store/auth"
import { setLocale } from "../../src/lib/i18n"
import type { SupportedLocale } from "@pulse/shared"

export default function ProfileScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t, i18n } = useTranslation("profile")
  const signOut = useAuth((s) => s.signOut)
  const utils = trpc.useUtils()

  const profile = trpc.user.me.useQuery()
  const stats = trpc.user.getStats.useQuery()
  const myBadges = trpc.badge.mine.useQuery()
  const myReferrals = trpc.user.getReferrals.useQuery()

  async function shareReferral(code: string) {
    try {
      await Share.share({
        message: t("shareMessage", "Join me on PULSE — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: pulse.app/r/{{code}}", { code }),
      })
    } catch {
      // user cancelled or platform error — silent
    }
  }
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
      Alert.alert(t("saved", "Saved"))
    },
  })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [homeCity, setHomeCity] = useState("")

  function startEditing() {
    setName(profile.data?.name ?? "")
    setHomeCity(profile.data?.homeCity ?? "")
    setEditing(true)
  }

  function save() {
    updateProfile.mutate(
      {
        ...(name.trim() !== (profile.data?.name ?? "") ? { name: name.trim() } : {}),
        ...(homeCity.trim() !== (profile.data?.homeCity ?? "") ? { homeCity: homeCity.trim() } : {}),
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  async function changeLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    updateProfile.mutate({ language: lng.toUpperCase() as "EN" | "RU" | "SR" })
  }

  if (profile.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary }}>{t("common:loading", "Loading…")}</Text>
      </View>
    )
  }

  const u = profile.data
  if (!u) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("common:notSignedIn", "Not signed in")}</Text>
      </View>
    )
  }

  const totalPoints = u.earnedPoints + u.welcomePoints
  const initial = (u.name ?? u.email ?? "?")[0]?.toUpperCase() ?? "?"
  const currentLng = (i18n.language as SupportedLocale) ?? "en"

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      {/* Avatar + name */}
      <View style={s.header}>
        <View style={[s.avatar, { backgroundColor: colors.pink }]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={[s.name, { color: theme.text }]}>{u.name ?? u.email}</Text>
        {u.homeCity ? (
          <Text style={[s.subtle, { color: theme.textSecondary }]}>{u.homeCity}</Text>
        ) : null}
      </View>

      {/* Points hero */}
      <View style={[s.hero, { backgroundColor: colors.pink }]}>
        <Text style={s.heroLabel}>{t("totalPoints", "Total points")}</Text>
        <Text style={s.heroValue}>{totalPoints.toLocaleString()}</Text>
        <Text style={s.heroSub}>
          {t("earned", "Earned")}: {u.earnedPoints} · {t("welcome", "Welcome")}: {u.welcomePoints}
        </Text>
      </View>

      {/* Stats */}
      <Section title={t("stats", "Your stats")} theme={theme}>
        <Row label={t("streakCurrent", "Current streak")} value={`${u.currentStreak} ${t("common:days", "days")}`} theme={theme} />
        <Row label={t("streakLongest", "Longest streak")} value={`${u.longestStreak} ${t("common:days", "days")}`} theme={theme} />
        <Row label={t("totalEarned", "Total earned (lifetime)")} value={`${u.totalEarnedLifetime}`} theme={theme} />
        {stats.data ? (
          <>
            <Row label={t("venuesVisited", "Venues visited")} value={`${stats.data.uniqueVenuesVisited}`} theme={theme} />
            <Row label={t("rewardsRedeemed", "Rewards redeemed")} value={`${stats.data.rewardsRedeemed}`} theme={theme} />
          </>
        ) : null}
      </Section>

      {/* Badges preview */}
      <Pressable onPress={() => router.push("/badges")} style={[s.badgesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={s.badgesHeader}>
          <Text style={[s.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>
            {t("badges", "Badges").toUpperCase()}
          </Text>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
            {(myBadges.data ?? []).length} →
          </Text>
        </View>
        <View style={s.badgesRow}>
          {(myBadges.data ?? []).slice(0, 6).map((b) => (
            <Text key={b.id} style={s.badgeIcon}>{b.iconUrl}</Text>
          ))}
          {(myBadges.data ?? []).length === 0 ? (
            <Text style={{ color: theme.textSecondary, fontSize: 12, paddingVertical: 8 }}>
              {t("noBadgesYet", "Earn your first badge by checking in or scanning a receipt")}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Edit profile */}
      <Section title={t("editProfile", "Edit profile")} theme={theme}>
        {editing ? (
          <>
            <Field label={t("name", "Name")} value={name} onChangeText={setName} theme={theme} />
            <Field label={t("homeCity", "Home city")} value={homeCity} onChangeText={setHomeCity} theme={theme} />
            <View style={s.btnRow}>
              <Button label={t("common:cancel", "Cancel")} variant="ghost" onPress={() => setEditing(false)} theme={theme} />
              <Button
                label={updateProfile.isPending ? t("common:saving", "Saving…") : t("common:save", "Save")}
                onPress={save}
                disabled={updateProfile.isPending}
                theme={theme}
              />
            </View>
          </>
        ) : (
          <Button label={t("editProfile", "Edit profile")} variant="ghost" onPress={startEditing} theme={theme} />
        )}
      </Section>

      {/* Language switch */}
      <Section title={t("language", "Language")} theme={theme}>
        <View style={s.btnRow}>
          {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => (
            <Pressable
              key={lng}
              onPress={() => changeLanguage(lng)}
              style={[
                s.langBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: currentLng === lng ? theme.text : "transparent",
                },
              ]}
            >
              <Text style={{ color: currentLng === lng ? theme.bg : theme.text, fontWeight: "600" }}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      {/* Referral */}
      <Section title={t("referralCode", "Your referral code")} theme={theme}>
        <View style={[s.codeBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[s.code, { color: theme.text }]}>{u.referralCode}</Text>
        </View>
        <Text style={[s.subtle, { color: theme.textSecondary, marginTop: 8, marginBottom: 12 }]}>
          {t("referralCodeHint", "Share with friends — they get 50 pts, you get 100 pts after their first purchase")}
        </Text>
        <View style={s.btnRow}>
          <Button label={t("share", "Share")} onPress={() => shareReferral(u.referralCode)} theme={theme} />
          <Button label={t("giftPoints", "Gift points")} variant="ghost" onPress={() => router.push("/gift")} theme={theme} />
        </View>
        <View style={[s.btnRow, { marginTop: 8 }]}>
          <Button label={t("friends", "Friends")} variant="ghost" onPress={() => router.push("/friends")} theme={theme} />
          <Button
            label={t("referralsCount", "{{count}} referred", { count: myReferrals.data?.length ?? 0 })}
            variant="ghost"
            onPress={() => router.push("/referrals")}
            theme={theme}
          />
        </View>
      </Section>

      {/* Sign out */}
      <View style={s.footer}>
        <Button label={t("signOut", "Sign out")} variant="danger" onPress={signOut} theme={theme} />
      </View>
    </ScrollView>
  )
}

// ── Components ────────────────────────────────────────────────

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  )
}

function Row({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[s.row, { borderBottomColor: theme.border }]}>
      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{value}</Text>
    </View>
  )
}

function Field({ label, value, onChangeText, theme }: { label: string; value: string; onChangeText: (v: string) => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={s.field}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[s.input, { color: theme.text, borderColor: theme.border }]}
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  )
}

function Button({
  label, onPress, disabled, variant = "primary", theme,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: "primary" | "ghost" | "danger"
  theme: ReturnType<typeof useTheme>
}) {
  const bg = variant === "primary" ? theme.text : variant === "danger" ? "#DC2626" : "transparent"
  const fg = variant === "ghost" ? theme.text : "#FFFFFF"
  const border = variant === "ghost" ? theme.border : "transparent"
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: fg, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { color: "#FFF", fontSize: 32, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700" },
  subtle: { fontSize: 13, marginTop: 4 },
  hero: { borderRadius: 16, padding: 20, marginBottom: 24, alignItems: "center" },
  heroLabel: { color: "#FFF", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, opacity: 0.85 },
  heroValue: { color: "#FFF", fontSize: 40, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "#FFF", fontSize: 12, marginTop: 6, opacity: 0.85 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  badgesCard: { marginBottom: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  badgesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeIcon: { fontSize: 28 },
  card: { borderRadius: 12, borderWidth: 1, padding: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  field: { padding: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  btnRow: { flexDirection: "row", gap: 8, padding: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  langBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  codeBox: { padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "center", margin: 12 },
  code: { fontSize: 22, fontWeight: "700", letterSpacing: 4, fontFamily: "monospace" },
  footer: { marginTop: 12 },
})
