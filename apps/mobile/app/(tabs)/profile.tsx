import { useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { colors, fonts, gradients, useTheme, type Theme } from "../../src/lib/theme"
import { NeuCard, NeuInset } from "../../src/components/neu"
import { trpc } from "../../src/lib/trpc"
import { useAuth } from "../../src/store/auth"
import { setLocale } from "../../src/lib/i18n"
import { CITY_OPTIONS } from "../../src/lib/venues"
import type { SupportedLocale } from "@pulse/shared"

const RARITY_GRADIENT: Record<string, readonly [string, string, ...string[]]> = {
  COMMON: gradients.graphite,
  RARE: gradients.black,
  EPIC: gradients.graphite,
  LEGENDARY: gradients.black,
}

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

  async function shareReferral(code: string) {
    try {
      await Share.share({
        message: t(
          "shareMessage",
          "Join me on PULSE — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: pulse.app/r/{{code}}",
          { code },
        ),
      })
    } catch { /* cancelled */ }
  }

  if (profile.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.text} />
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

  const initial = (u.name ?? u.email ?? "?")[0]?.toUpperCase() ?? "?"
  const currentLng = (i18n.language as SupportedLocale) ?? "en"
  const badges = myBadges.data ?? []

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      {/* Hero */}
      <NeuCard gradient={gradients.black} style={[s.hero, { borderRadius: 50 }]}>
        <View style={s.heroBlob} />
        <View style={s.heroRow}>
          <View style={s.heroAvatar}>
            <Text style={[s.heroAvatarText, { fontFamily: fonts.displayHeavy }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
              {u.name ?? u.email}
            </Text>
            {u.homeCity ? (
              <Text style={s.heroCity}>⌖ {u.homeCity}</Text>
            ) : null}
            <View style={s.refBadge}>
              <Text style={[s.refBadgeText, { fontFamily: fonts.bodyBold }]}>{u.referralCode}</Text>
            </View>
          </View>
        </View>
      </NeuCard>

      {/* Stats */}
      <View style={s.statsRow}>
        <StatTile
          gradient={gradients.aqua}
          label={t("totalPts", "Total pts")}
          value={u.totalEarnedLifetime.toLocaleString()}
        />
        <StatTile
          gradient={gradients.aqua}
          label={t("streak", "Streak")}
          value={`${u.currentStreak}d`}
        />
        <StatTile
          gradient={gradients.pearl}
          label={t("best", "Best")}
          value={`${u.longestStreak}d`}
        />
      </View>

      {/* Lifetime stats */}
      {stats.data ? (
        <NeuCard style={{ marginBottom: 20, padding: 0 }}>
          <Row label={t("venuesVisited", "Venues visited")} value={`${stats.data.uniqueVenuesVisited}`} theme={theme} last={false} />
          <Row label={t("rewardsRedeemed", "Rewards redeemed")} value={`${stats.data.rewardsRedeemed}`} theme={theme} last={true} />
        </NeuCard>
      ) : null}

      {/* Badges */}
      <Text style={[s.h2, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("badges", "Badges")}
      </Text>
      <Pressable onPress={() => router.push("/badges")}>
        {badges.length === 0 ? (
          <NeuCard style={{ padding: 20, alignItems: "center", marginBottom: 20 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
              {t("noBadgesYet", "Earn your first badge by checking in or scanning a receipt")}
            </Text>
          </NeuCard>
        ) : (
          <View style={s.badgeGrid}>
            {badges.slice(0, 6).map((b) => {
              const grad = RARITY_GRADIENT[b.rarity] ?? gradients.violet
              return (
                <NeuCard key={b.id} gradient={grad} small style={s.badgeCard}>
                  <Text style={s.badgeIcon}>{b.iconUrl}</Text>
                  <Text style={[s.badgeName, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={s.badgeRarity}>{b.rarity}</Text>
                </NeuCard>
              )
            })}
          </View>
        )}
      </Pressable>

      {/* Referral */}
      <NeuCard gradient={gradients.black} style={s.referralCard}>
        <Text style={s.referralLabel}>
          {t("referralCode", "Referral code").toUpperCase()}
        </Text>
        <Text style={[s.referralCode, { fontFamily: fonts.displayHeavy }]}>{u.referralCode}</Text>
        <Text style={s.referralHint}>{t("referralHintShort", "Friends +50 · You +100 after first buy")}</Text>
        <View style={s.referralBtns}>
          <Pressable
            onPress={() => shareReferral(u.referralCode)}
            style={s.referralBtnInner}
          >
            <Text style={[s.referralBtnText, { fontFamily: fonts.bodyBold }]}>↗ {t("share", "Share")}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/gift")}
            style={s.referralBtnInner}
          >
            <Text style={[s.referralBtnText, { fontFamily: fonts.bodyBold }]}>□ {t("giftPoints", "Gift")}</Text>
          </Pressable>
        </View>
        <Text
          onPress={() => router.push("/referrals")}
          style={s.refsCount}
        >
          {t("referralsCount", "{{count}} referred", { count: myReferrals.data?.length ?? 0 })} →
        </Text>
      </NeuCard>

      {/* Friends shortcut */}
      <NeuCard
        onPress={() => router.push("/friends")}
        style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}
      >
        <View>
          <Text style={[s.shortcutTitle, { color: theme.text, fontFamily: fonts.bodyBold }]}>
            {t("friends", "Friends")}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            {t("seeFriendsActivity", "See what your friends are up to")}
          </Text>
        </View>
        <Text style={{ color: theme.textSecondary, fontSize: 18 }}>→</Text>
      </NeuCard>

      {/* Edit profile */}
      <Text style={[s.h2, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("editProfile", "Edit profile")}
      </Text>
      <NeuCard style={{ padding: 14, marginBottom: 20 }}>
        {editing ? (
          <>
            <Field label={t("name", "Name")} value={name} onChangeText={setName} theme={theme} />
            <Field label={t("homeCity", "Home city")} value={homeCity} onChangeText={setHomeCity} theme={theme} />
            <View style={s.cityRow}>
              {CITY_OPTIONS.map((city) => {
                const active = homeCity === city.name
                return (
                  <Pressable
                    key={city.name}
                    onPress={() => setHomeCity(city.name)}
                    style={[s.cityChip, active ? s.cityChipActive : s.cityChipIdle]}
                  >
                    <Text style={[s.cityChipText, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                      {city.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn label={t("common:cancel", "Cancel")} variant="ghost" onPress={() => setEditing(false)} />
              <Btn
                label={updateProfile.isPending ? t("common:saving", "Saving…") : t("common:save", "Save")}
                onPress={save}
                disabled={updateProfile.isPending}
              />
            </View>
          </>
        ) : (
          <Btn label={t("editProfile", "Edit profile")} variant="ghost" onPress={startEditing} />
        )}
      </NeuCard>

      {/* Language */}
      <Text style={[s.h2, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("language", "Language")}
      </Text>
      <View style={s.langRow}>
        {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => {
          const active = currentLng === lng
          if (active) {
            return (
              <Pressable key={lng} onPress={() => changeLanguage(lng)} style={{ flex: 1 }}>
                <LinearGradient
                  colors={gradients.black as unknown as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.langChip, theme.shadowGlow]}
                >
                  <Text style={[s.langChipActive, { fontFamily: fonts.bodyBold }]}>{lng.toUpperCase()}</Text>
                </LinearGradient>
              </Pressable>
            )
          }
          return (
            <Pressable
              key={lng}
              onPress={() => changeLanguage(lng)}
              style={[s.langChip, { backgroundColor: theme.bg, flex: 1 }, theme.shadowRaisedSm]}
            >
              <Text style={[s.langChipText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Sign out */}
      <Pressable onPress={signOut} style={[s.signOut, { backgroundColor: "rgba(220,38,38,0.08)" }]}>
        <Text style={[s.signOutText, { fontFamily: fonts.bodyBold }]}>{t("signOut", "Sign out")}</Text>
      </Pressable>
    </ScrollView>
  )
}

// ── helpers ───────────────────────────────────────────────────

function StatTile({
  gradient, label, value,
}: { gradient: readonly [string, string, ...string[]]; label: string; value: string }) {
  return (
    <NeuCard gradient={gradient} style={s.statTile} small>
      <Text style={[s.statValue, { fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
    </NeuCard>
  )
}

function Row({ label, value, theme, last }: { label: string; value: string; theme: Theme; last: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 }]}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, fontFamily: fonts.bodyBold }}>{value}</Text>
    </View>
  )
}

function Field({
  label, value, onChangeText, theme,
}: { label: string; value: string; onChangeText: (v: string) => void; theme: Theme }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 11, fontFamily: fonts.bodyBold, letterSpacing: 0.5, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <NeuInset>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={{ padding: 12, fontSize: 14, color: theme.text, fontFamily: fonts.body }}
          placeholderTextColor={theme.textMuted}
        />
      </NeuInset>
    </View>
  )
}

function Btn({
  label, onPress, variant = "primary", disabled,
}: { label: string; onPress: () => void; variant?: "primary" | "ghost"; disabled?: boolean }) {
  const theme = useTheme()
  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}>
        <LinearGradient
          colors={gradients.black as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[{ padding: 12, borderRadius: 10, alignItems: "center" }, theme.shadowGlow]}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[{ flex: 1, padding: 12, borderRadius: 10, alignItems: "center", backgroundColor: theme.bg }, theme.shadowRaisedSm]}
    >
      <Text style={{ color: theme.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: { padding: 18, marginBottom: 14, overflow: "hidden" },
  heroBlob: { position: "absolute", top: -48, right: -44, width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroAvatar: {
    width: 70, height: 70, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.46)",
  },
  heroAvatarText: { color: colors.ink, fontSize: 28 },
  heroName: { color: colors.ink, fontSize: 25, lineHeight: 29 },
  heroCity: { color: "#91A1B4", fontSize: 13, marginTop: 2 },
  refBadge: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  refBadgeText: { color: colors.ink, fontSize: 11, letterSpacing: 1.5 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statTile: { flex: 1, padding: 14, minHeight: 86 },
  statValue: { color: colors.ink, fontSize: 24, lineHeight: 26 },
  statLabel: { color: "#91A1B4", fontSize: 9, marginTop: 4, letterSpacing: 0.8, fontWeight: "700" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },

  h2: { fontSize: 25, marginBottom: 12 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  badgeCard: { width: "31%", padding: 12, alignItems: "center", minHeight: 104 },
  badgeIcon: { fontSize: 26, marginBottom: 6 },
  badgeName: { color: colors.ink, fontSize: 12 },
  badgeRarity: { color: "#91A1B4", fontSize: 9, marginTop: 2, letterSpacing: 0.5, fontWeight: "700" },

  referralCard: { padding: 20, marginBottom: 16, alignItems: "center" },
  referralLabel: { color: "#91A1B4", fontSize: 11, letterSpacing: 1.5, fontWeight: "700", marginBottom: 8 },
  referralCode: { color: colors.ink, fontSize: 28, letterSpacing: 5 },
  referralHint: { color: "#91A1B4", fontSize: 11, marginTop: 8, textAlign: "center" },
  referralBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  referralBtnInner: { backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
  referralBtnText: { color: colors.ink, fontSize: 13 },
  refsCount: { color: colors.ink, fontSize: 12, fontWeight: "700", marginTop: 12 },

  shortcutTitle: { fontSize: 15 },

  cityRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  cityChip: { flex: 1, borderRadius: 99, paddingVertical: 10, alignItems: "center" },
  cityChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 2 },
  cityChipIdle: { backgroundColor: "rgba(249,251,255,0.66)" },
  cityChipText: { fontSize: 12 },

  langRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  langChip: { paddingVertical: 12, borderRadius: 99, alignItems: "center" },
  langChipText: { fontSize: 13 },
  langChipActive: { color: colors.ink, fontSize: 13 },

  signOut: { padding: 14, borderRadius: 99, alignItems: "center" },
  signOutText: { color: "#DC2626", fontSize: 14 },
})
