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

const DEMO_PROFILE = {
  id: "demo",
  email: "demo@pulse.app",
  name: "Demo User",
  avatarUrl: null,
  homeCity: "Belgrade",
  language: "EN",
  earnedPoints: 1240,
  welcomePoints: 300,
  welcomeExpiresAt: new Date(Date.now() + 21 * 86_400_000),
  lastWelcomeUsedAt: null,
  totalEarnedLifetime: 3840,
  spentPoints: 910,
  currentStreak: 7,
  longestStreak: 18,
  lastCheckinAt: null,
  stepsToday: 8420,
  stepsTotal: 128400,
  referralCode: "PULSE1",
  referredById: null,
  onboardingDone: true,
  createdAt: new Date("2026-01-15T00:00:00.000Z"),
  totalPoints: 1540,
}

const DEMO_BADGES = [
  { id: "demo-badge-1", code: "FIRST_SCAN", name: "First scan", description: "Scan your first receipt", iconUrl: "✓", rarity: "COMMON", unlockedAt: new Date() },
  { id: "demo-badge-2", code: "WEEK_STREAK", name: "7 day streak", description: "Keep visiting for a week", iconUrl: "✦", rarity: "RARE", unlockedAt: new Date() },
  { id: "demo-badge-3", code: "CITY_EXPLORER", name: "Explorer", description: "Visit multiple venues", iconUrl: "⌖", rarity: "EPIC", unlockedAt: new Date() },
]

const DEMO_REDEMPTIONS = [
  { id: "demo-redemption-1", reward: { title: "Free coffee upgrade", pointsCost: 250 } },
  { id: "demo-redemption-2", reward: { title: "Dessert discount", pointsCost: 420 } },
]

export default function ProfileScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t, i18n } = useTranslation("profile")
  const token = useAuth((s) => s.token)
  const signOut = useAuth((s) => s.signOut)
  const utils = trpc.useUtils()
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1"
  const hasToken = Boolean(token)
  const showDemoProfile = demoMode || !hasToken

  const profile = trpc.user.me.useQuery(undefined, { enabled: hasToken })
  const stats = trpc.user.getStats.useQuery(undefined, { enabled: hasToken })
  const myBadges = trpc.badge.mine.useQuery(undefined, { enabled: hasToken })
  const myReferrals = trpc.user.getReferrals.useQuery(undefined, { enabled: hasToken })
  const friends = trpc.social.friends.useQuery(undefined, { enabled: hasToken })
  const redemptions = trpc.user.myRedemptions.useQuery({ limit: 3 }, { enabled: hasToken })

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

  if (hasToken && profile.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    )
  }
  const useDemoProfile = showDemoProfile || profile.isError
  const u = profile.data ?? (useDemoProfile ? DEMO_PROFILE : null)
  if (!u) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("common:notSignedIn", "Not signed in")}</Text>
      </View>
    )
  }

  const initial = (u.name ?? u.email ?? "?")[0]?.toUpperCase() ?? "?"
  const currentLng = (i18n.language as SupportedLocale) ?? "en"
  const badges = myBadges.data ?? (useDemoProfile ? DEMO_BADGES : [])
  const totalPoints = u.totalPoints
  const nextMilestone = Math.max(500, Math.ceil((totalPoints + 1) / 500) * 500)
  const progressPct = Math.min(100, Math.round((totalPoints / nextMilestone) * 100))
  const memberSince = new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
  const welcomeDaysLeft = u.welcomeExpiresAt
    ? Math.max(0, Math.ceil((new Date(u.welcomeExpiresAt).getTime() - Date.now()) / 86_400_000))
    : null
  const referralsCount = myReferrals.data?.length ?? (useDemoProfile ? 3 : 0)
  const friendsCount = friends.data?.length ?? (useDemoProfile ? 4 : 0)
  const recentRedemptions = redemptions.data?.redemptions ?? (useDemoProfile ? DEMO_REDEMPTIONS : [])
  const lifetimeStats = stats.data ?? (useDemoProfile
    ? {
        totalEarnedLifetime: DEMO_PROFILE.totalEarnedLifetime,
        spentPoints: DEMO_PROFILE.spentPoints,
        currentStreak: DEMO_PROFILE.currentStreak,
        longestStreak: DEMO_PROFILE.longestStreak,
        referralCode: DEMO_PROFILE.referralCode,
        transactionCount: 24,
        uniqueVenuesVisited: 8,
        rewardsRedeemed: 2,
      }
    : null)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.screenHead}>
        <View>
          <Text style={[s.kicker, { fontFamily: fonts.bodyBold }]}>PULSE ID</Text>
          <Text style={[s.screenTitle, { fontFamily: fonts.displayHeavy }]}>
            {t("personalCabinet", "Personal cabinet")}
          </Text>
        </View>
        <Pressable onPress={startEditing} style={[s.headButton, theme.shadowRaisedSm]}>
          <Text style={[s.headButtonText, { fontFamily: fonts.bodyBold }]}>✎</Text>
        </Pressable>
      </View>

      <NeuCard gradient={gradients.black} style={s.hero}>
        <View style={s.heroBlob} />
        <View style={s.heroTop}>
          <View style={s.heroRow}>
            <View style={s.heroAvatar}>
              <Text style={[s.heroAvatarText, { fontFamily: fonts.displayHeavy }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
                {u.name ?? u.email}
              </Text>
              <Text style={s.heroMail} numberOfLines={1}>{u.email}</Text>
              {u.homeCity ? <Text style={s.heroCity}>⌖ {u.homeCity}</Text> : null}
            </View>
          </View>
          <View style={s.refBadge}>
            <Text style={[s.refBadgeText, { fontFamily: fonts.bodyBold }]}>{u.referralCode}</Text>
          </View>
        </View>

        <View style={s.balancePanel}>
          <View>
            <Text style={[s.balanceLabel, { fontFamily: fonts.bodyBold }]}>
              {t("availableBalance", "Available balance").toUpperCase()}
            </Text>
            <Text style={[s.balanceValue, { fontFamily: fonts.displayHeavy }]}>{totalPoints.toLocaleString()}</Text>
            <Text style={s.balanceSub}>pts</Text>
          </View>
          <View style={s.balanceSplit}>
            <MiniBalance label={t("earned", "Earned")} value={u.earnedPoints} />
            <MiniBalance label={t("welcome", "Welcome")} value={u.welcomePoints} />
          </View>
        </View>

        <View style={s.levelBlock}>
          <View style={s.levelHead}>
            <Text style={[s.levelText, { fontFamily: fonts.bodyBold }]}>
              {totalPoints.toLocaleString()} / {nextMilestone.toLocaleString()}
            </Text>
            <Text style={[s.levelText, { fontFamily: fonts.bodyBold }]}>{progressPct}%</Text>
          </View>
          <View style={s.levelTrack}>
            <View style={[s.levelFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      </NeuCard>

      <View style={s.quickGrid}>
        <QuickAction icon="⌖" label={t("checkIn", "Check in")} sub={t("earnNow", "Earn now")} onPress={() => router.push("/checkin")} />
        <QuickAction icon="↯" label={t("scanReceipt", "Scan receipt")} sub={t("receipt", "Receipt")} onPress={() => router.push("/scan")} />
        <QuickAction icon="□" label={t("giftPoints", "Gift")} sub={t("sendPoints", "Send pts")} onPress={() => router.push("/gift")} />
        <QuickAction icon="◦" label={t("friends", "Friends")} sub={`${friendsCount} ${t("people", "people")}`} onPress={() => router.push("/friends")} />
      </View>

      <SectionTitle title={t("activity", "Activity")} action={t("leaderboard", "Leaderboard")} onPress={() => router.push("/leaderboard")} />
      <View style={s.statsRow}>
        <StatTile label={t("lifetime", "Lifetime")} value={u.totalEarnedLifetime.toLocaleString()} />
        <StatTile label={t("streak", "Streak")} value={`${u.currentStreak}d`} />
        <StatTile label={t("steps", "Steps")} value={u.stepsToday.toLocaleString()} />
      </View>

      {lifetimeStats ? (
        <NeuCard style={s.infoCard}>
          <Row label={t("venuesVisited", "Venues visited")} value={`${lifetimeStats.uniqueVenuesVisited}`} theme={theme} last={false} />
          <Row label={t("rewardsRedeemed", "Rewards redeemed")} value={`${lifetimeStats.rewardsRedeemed}`} theme={theme} last={false} />
          <Row label={t("spentPoints", "Spent points")} value={`${lifetimeStats.spentPoints.toLocaleString()} pts`} theme={theme} last={true} />
        </NeuCard>
      ) : null}

      <SectionTitle title={t("account", "Account")} action={t("editProfile", "Edit")} onPress={startEditing} />
      <View style={s.accountGrid}>
        <AccountTile label={t("homeCity", "Home city")} value={u.homeCity ?? "—"} />
        <AccountTile label={t("language", "Language")} value={currentLng.toUpperCase()} />
        <AccountTile label={t("memberSince", "Member since")} value={memberSince} />
        <AccountTile
          label={t("welcomeLeft", "Welcome left")}
          value={welcomeDaysLeft === null ? "—" : `${welcomeDaysLeft}d`}
        />
      </View>

      <SectionTitle title={t("badges", "Badges")} action={t("all", "All")} onPress={() => router.push("/badges")} />
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

      <SectionTitle title={t("network", "Network")} action={t("details", "Details")} onPress={() => router.push("/referrals")} />
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
          {t("referralsCount", "{{count}} referred", { count: referralsCount })} · {friendsCount} {t("friends", "friends")} →
        </Text>
      </NeuCard>

      <SectionTitle title={t("recentRewards", "Recent rewards")} action={t("rewards", "Rewards")} onPress={() => router.push("/rewards")} />
      <NeuCard style={s.infoCard}>
        {recentRedemptions.length === 0 ? (
          <View style={s.emptyHistory}>
            <Text style={[s.emptyHistoryText, { color: theme.textSecondary }]}>
              {t("noRewardHistory", "Redeemed rewards will appear here")}
            </Text>
          </View>
        ) : (
          recentRedemptions.map((redemption, index) => (
            <Row
              key={redemption.id}
              label={redemption.reward.title}
              value={`${redemption.reward.pointsCost} pts`}
              theme={theme}
              last={index === recentRedemptions.length - 1}
            />
          ))
        )}
      </NeuCard>

      <SectionTitle title={t("settings", "Settings")} />
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

function MiniBalance({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.miniBalance}>
      <Text style={[s.miniBalanceValue, { fontFamily: fonts.displayHeavy }]}>{value.toLocaleString()}</Text>
      <Text style={[s.miniBalanceLabel, { fontFamily: fonts.bodyBold }]}>{label.toUpperCase()}</Text>
    </View>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <NeuCard gradient={gradients.black} style={s.statTile} small>
      <Text style={[s.statValue, { fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
    </NeuCard>
  )
}

function QuickAction({
  icon, label, sub, onPress,
}: { icon: string; label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.quickPressable}>
      <NeuCard style={s.quickCard} small>
        <View style={s.quickIcon}>
          <Text style={[s.quickIconText, { fontFamily: fonts.displayHeavy }]}>{icon}</Text>
        </View>
        <Text style={[s.quickLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{label}</Text>
        <Text style={s.quickSub} numberOfLines={1}>{sub}</Text>
      </NeuCard>
    </Pressable>
  )
}

function AccountTile({ label, value }: { label: string; value: string }) {
  return (
    <NeuCard style={s.accountTile} small>
      <Text style={[s.accountLabel, { fontFamily: fonts.bodyBold }]}>{label.toUpperCase()}</Text>
      <Text style={[s.accountValue, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{value}</Text>
    </NeuCard>
  )
}

function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.h2, { fontFamily: fonts.displayHeavy }]}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress} style={s.sectionAction}>
          <Text style={[s.sectionActionText, { fontFamily: fonts.bodyBold }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
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

  screenHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  kicker: { color: "#B0D4E3", fontSize: 11, letterSpacing: 1.8 },
  screenTitle: { color: colors.ink, fontSize: 34, lineHeight: 38, letterSpacing: 0 },
  headButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F9FBFF", alignItems: "center", justifyContent: "center" },
  headButtonText: { color: colors.ink, fontSize: 18 },

  hero: { padding: 18, marginBottom: 14, overflow: "hidden", borderRadius: 50 },
  heroBlob: { position: "absolute", top: -48, right: -44, width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroAvatar: {
    width: 70, height: 70, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.46)",
  },
  heroAvatarText: { color: colors.ink, fontSize: 28 },
  heroName: { color: colors.ink, fontSize: 25, lineHeight: 29 },
  heroMail: { color: "#A3B1C6", fontSize: 12, marginTop: 1 },
  heroCity: { color: "#91A1B4", fontSize: 13, marginTop: 2 },
  refBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.66)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  refBadgeText: { color: colors.ink, fontSize: 11, letterSpacing: 1.5 },

  balancePanel: { borderRadius: 34, backgroundColor: "rgba(255,255,255,0.50)", padding: 16, flexDirection: "row", justifyContent: "space-between", gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  balanceLabel: { color: "#91A1B4", fontSize: 10, letterSpacing: 1 },
  balanceValue: { color: colors.ink, fontSize: 48, lineHeight: 52, marginTop: 2 },
  balanceSub: { color: "#91A1B4", fontSize: 13 },
  balanceSplit: { width: 104, gap: 8 },
  miniBalance: { backgroundColor: "rgba(255,255,255,0.46)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  miniBalanceValue: { color: colors.ink, fontSize: 18, lineHeight: 20 },
  miniBalanceLabel: { color: "#91A1B4", fontSize: 8, letterSpacing: 0.8, marginTop: 2 },
  levelBlock: { marginTop: 14 },
  levelHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  levelText: { color: "#91A1B4", fontSize: 11 },
  levelTrack: { height: 9, borderRadius: 8, backgroundColor: "rgba(163,177,198,0.16)", overflow: "hidden" },
  levelFill: { height: "100%", borderRadius: 8, backgroundColor: "rgba(133,245,242,0.92)" },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  quickPressable: { width: "48.5%" },
  quickCard: { padding: 14, minHeight: 112, borderRadius: 30 },
  quickIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(235,254,255,0.88)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  quickIconText: { color: "#7FAFC2", fontSize: 20 },
  quickLabel: { color: colors.ink, fontSize: 15 },
  quickSub: { color: "#91A1B4", fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statTile: { flex: 1, padding: 14, minHeight: 86 },
  statValue: { color: colors.ink, fontSize: 24, lineHeight: 26 },
  statLabel: { color: "#91A1B4", fontSize: 9, marginTop: 4, letterSpacing: 0.8, fontWeight: "700" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  h2: { color: colors.ink, fontSize: 25 },
  sectionAction: { backgroundColor: "#F9FBFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 1 },
  sectionActionText: { color: "#91A1B4", fontSize: 11 },
  infoCard: { marginBottom: 20, padding: 0, borderRadius: 32 },
  accountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  accountTile: { width: "48.5%", padding: 14, minHeight: 84, borderRadius: 28 },
  accountLabel: { color: "#91A1B4", fontSize: 9, letterSpacing: 0.8 },
  accountValue: { color: colors.ink, fontSize: 17, marginTop: 8 },

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
  emptyHistory: { padding: 18, alignItems: "center" },
  emptyHistoryText: { fontSize: 13, textAlign: "center" },

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
