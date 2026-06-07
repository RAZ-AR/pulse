import { useState } from "react"
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native"
import QRCode from "react-native-qrcode-svg"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { fonts, pass, useTheme, type Theme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"

function ProfilePerforation() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: pass.dark, height: 26 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: pass.bg, marginLeft: -10 }} />
      <View style={{ flex: 1, flexDirection: "row", gap: 3, overflow: "hidden", justifyContent: "center" }}>
        {Array.from({ length: 36 }).map((_, i) => (
          <View key={i} style={{ width: 6, height: 1, backgroundColor: pass.perf }} />
        ))}
      </View>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: pass.bg, marginRight: -10 }} />
    </View>
  )
}

function ProfileBarcodeDecor() {
  const bars = [3,1,2,1,4,1,2,3,1,2,1,3,1,2,4,1,2,1,3,2,1,4,1,2,1,3,1,2,4,1,2,3,1,2,1]
  return (
    <View style={{ flexDirection: "row", gap: 2, height: 28, alignItems: "stretch", opacity: 0.18, paddingHorizontal: 2 }}>
      {bars.map((w, i) => (
        <View key={i} style={{ width: w * 2.2, backgroundColor: pass.dark, borderRadius: 1 }} />
      ))}
    </View>
  )
}
import { trpc } from "../../src/lib/trpc"
import { useAuth } from "../../src/store/auth"
import { setLocale } from "../../src/lib/i18n"
import { CITY_OPTIONS } from "../../src/lib/venues"
import { formatLoyaltyId } from "@pulse/shared"
import type { SupportedLocale } from "@pulse/shared"

const AVATAR_COLORS = ["#1f71b8", "#ea5b0c", "#B38BC8", "#273AA8", "#806828", "#FFFFFF", "#000000"]

function getAvatarColor(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith("color:")) return null
  const idx = parseInt(avatarUrl.slice(6), 10)
  return AVATAR_COLORS[idx] ?? null
}


const DEMO_PROFILE = {
  id: "demo",
  email: "demo@ayoo.space",
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
  cardNumber: "45678",
  referralCode: "AYOO1",
  referredById: null,
  onboardingDone: true,
  birthday: null as Date | null,
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
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const router = useRouter()
  const { t, i18n } = useTranslation("profile")
  const token = useAuth((s) => s.token)
  const signOut = useAuth((s) => s.signOut)
  const utils = trpc.useUtils()
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1"
  const hasToken = Boolean(token)
  const showDemoProfile = demoMode || !hasToken
  const queryEnabled = hasToken && !demoMode

  const profile = trpc.user.me.useQuery(undefined, { enabled: queryEnabled })
  const stats = trpc.user.getStats.useQuery(undefined, { enabled: queryEnabled })
  const myBadges = trpc.badge.mine.useQuery(undefined, { enabled: queryEnabled })
  const myReferrals = trpc.user.getReferrals.useQuery(undefined, { enabled: queryEnabled })
  const friends = trpc.social.friends.useQuery(undefined, { enabled: queryEnabled })
  const redemptions = trpc.user.myRedemptions.useQuery({ limit: 3 }, { enabled: queryEnabled })

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
      Alert.alert(t("saved", "Saved"))
    },
  })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [homeCity, setHomeCity] = useState("")
  const [editBirthday, setEditBirthday] = useState("")
  const [editAvatarColor, setEditAvatarColor] = useState<number | null>(null)

  function startEditing() {
    const current = profile.data ?? (showDemoProfile ? DEMO_PROFILE : null)
    setName(current?.name ?? "")
    setHomeCity(current?.homeCity ?? "")
    const existingColor = getAvatarColor(current?.avatarUrl ?? null)
    setEditAvatarColor(existingColor ? AVATAR_COLORS.indexOf(existingColor) : 0)
    const bd = (current as { birthday?: Date | null } | null)?.birthday
    if (bd) {
      const d = new Date(bd)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      setEditBirthday(`${yyyy}-${mm}-${dd}`)
    } else {
      setEditBirthday("")
    }
    setEditing(true)
  }

  function save() {
    const isoDate = editBirthday.match(/^\d{4}-\d{2}-\d{2}$/) ? editBirthday : undefined
    updateProfile.mutate(
      {
        ...(name.trim() !== (profile.data?.name ?? "") ? { name: name.trim() } : {}),
        ...(homeCity.trim() !== (profile.data?.homeCity ?? "") ? { homeCity: homeCity.trim() } : {}),
        ...(isoDate ? { birthday: isoDate } : {}),
        ...(editAvatarColor !== null ? { avatarUrl: `color:${editAvatarColor}` } : {}),
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
          "Join me on ayoo — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: ayoo.space/r/{{code}}",
          { code },
        ),
      })
    } catch { /* cancelled */ }
  }

  const useDemoProfile = showDemoProfile || profile.isError || profile.isLoading
  const u = profile.data ?? (useDemoProfile ? DEMO_PROFILE : null)
  if (!u) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("common:notSignedIn", "Not signed in")}</Text>
      </View>
    )
  }

  const initial = (u.name ?? u.email ?? "?")[0]?.toUpperCase() ?? "?"
  const avatarBgColor = getAvatarColor(u.avatarUrl)
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
    <ScrollView style={[s.scroll, { backgroundColor: pass.bg }]} contentContainerStyle={s.content}>
      <View style={s.screenHead}>
        <View>
          <Text style={[s.kicker, { fontFamily: fonts.bodyBold }]}>ayoo ID</Text>
          <Text style={[s.screenTitle, { fontFamily: fonts.displayHeavy }]}>
            {t("personalCabinet", "Personal cabinet")}
          </Text>
        </View>
        <Pressable onPress={startEditing} style={s.headButton}>
          <Text style={[s.headButtonText, { fontFamily: fonts.bodyBold }]}>✎</Text>
        </Pressable>
      </View>

      {/* ── Physical Pass Hero ── */}
      <View style={s.passHero}>
        {/* Dark top */}
        <View style={s.passHeroTop}>
          <View style={s.passHeroHeader}>
            <View style={[s.passAvatar, avatarBgColor ? { backgroundColor: avatarBgColor } : {}]}>
              <Text style={[s.passAvatarText, { fontFamily: fonts.displayHeavy }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.passHeroLabel, { fontFamily: fonts.bodyBold }]}>MEMBER PASS</Text>
              <Text style={[s.passHeroName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
                {u.name ?? u.email}
              </Text>
              {u.homeCity ? (
                <Text style={[s.passHeroCity, { fontFamily: fonts.bodyBold }]}>⌖ {u.homeCity.toUpperCase()}</Text>
              ) : null}
            </View>
            <View style={s.passRefBadge}>
              <Text style={[s.passRefBadgeText, { fontFamily: fonts.bodyBold }]}>{u.referralCode}</Text>
            </View>
          </View>

          {/* Loyalty ID strip */}
          {u.cardNumber ? (
            <View style={s.passIdStrip}>
              <Text style={[s.passIdLabel, { fontFamily: fonts.bodyBold }]}>LOYALTY ID</Text>
              <Text style={[s.passIdNumber, { fontFamily: fonts.displayHeavy }]}>
                {formatLoyaltyId(new Date(u.createdAt), u.cardNumber).replace(/(\d{7})(\d+)/, "$1 · $2")}
              </Text>
            </View>
          ) : null}

          {/* Balance */}
          <View style={s.passBalance}>
            <View style={{ flex: 1 }}>
              <Text style={[s.passBalanceLabel, { fontFamily: fonts.bodyBold }]}>
                {t("availableBalance", "AVAILABLE BALANCE").toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={[s.passBalanceValue, { fontFamily: fonts.displayHeavy }]}>{totalPoints.toLocaleString()}</Text>
                <Text style={[s.passBalanceSub, { fontFamily: fonts.bodyBold }]}>pts</Text>
              </View>
            </View>
            <View style={s.passBalanceSplit}>
              <View style={s.passBalanceChip}>
                <Text style={[s.passBalanceChipValue, { fontFamily: fonts.displayHeavy }]}>{u.earnedPoints.toLocaleString()}</Text>
                <Text style={[s.passBalanceChipLabel, { fontFamily: fonts.bodyBold }]}>{t("earned", "EARNED")}</Text>
              </View>
              <View style={s.passBalanceChip}>
                <Text style={[s.passBalanceChipValue, { fontFamily: fonts.displayHeavy }]}>{u.welcomePoints.toLocaleString()}</Text>
                <Text style={[s.passBalanceChipLabel, { fontFamily: fonts.bodyBold }]}>{t("welcome", "WELCOME")}</Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={s.passProgress}>
            <View style={s.passProgressTrack}>
              <View style={[s.passProgressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={[s.passProgressLabel, { fontFamily: fonts.bodyBold }]}>
              {totalPoints.toLocaleString()} / {nextMilestone.toLocaleString()} pts
            </Text>
          </View>
        </View>

        {/* Perforation */}
        <ProfilePerforation />

        {/* Cream bottom: QR */}
        <View style={s.passHeroBottom}>
          <View style={s.passQrSection}>
            <View style={s.passQrBox}>
              <QRCode
                value={`ayoo://user/${u.referralCode}`}
                size={120}
                color={pass.dark}
                backgroundColor="#FFFFFF"
              />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[s.passQrHint, { fontFamily: fonts.bodyBold }]}>
                {t("qrHint", "Show to merchant to earn / pay with points")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => shareReferral(u.referralCode)} style={s.passQrBtn}>
                  <Text style={[s.passQrBtnText, { fontFamily: fonts.bodyBold }]}>↗ {t("share", "Share")}</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/gift")} style={[s.passQrBtn, s.passQrBtnOrange]}>
                <Text style={[s.passQrBtnText, s.passQrBtnTextBlue, { fontFamily: fonts.bodyBold }]}>□ {t("giftPoints", "Gift")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <ProfileBarcodeDecor />
        </View>
      </View>

      <View style={s.quickGrid}>
        <QuickAction icon="⌖" label={t("checkIn", "Check in")} sub={t("earnNow", "Earn now")} tone="orange" onPress={() => router.push("/checkin")} />
        <QuickAction icon="↯" label={t("scanReceipt", "Scan receipt")} sub={t("receipt", "Receipt")} tone="dark" onPress={() => router.push("/scan")} />
        <QuickAction icon="□" label={t("giftPoints", "Gift")} sub={t("sendPoints", "Send pts")} tone="mint" onPress={() => router.push("/gift")} />
        <QuickAction icon="◦" label={t("friends", "Friends")} sub={`${friendsCount} ${t("people", "people")}`} tone="white" onPress={() => router.push("/friends")} />
      </View>

      <SectionTitle title={t("activity", "Activity")} action={t("leaderboard", "Leaderboard")} onPress={() => router.push("/leaderboard")} />
      <View style={s.statsRow}>
        <PassStatTile label={t("lifetime", "Lifetime")} value={u.totalEarnedLifetime.toLocaleString()} accent={pass.orange} />
        <PassStatTile label={t("streak", "Streak")} value={`${u.currentStreak}d`} accent={pass.dark} />
        <PassStatTile label={t("steps", "Steps")} value={u.stepsToday.toLocaleString()} accent={pass.mintDark} />
      </View>

      {lifetimeStats ? (
        <View style={s.infoCard}>
          <Row label={t("venuesVisited", "Venues visited")} value={`${lifetimeStats.uniqueVenuesVisited}`} theme={theme} last={false} />
          <Row label={t("rewardsRedeemed", "Rewards redeemed")} value={`${lifetimeStats.rewardsRedeemed}`} theme={theme} last={false} />
          <Row label={t("spentPoints", "Spent points")} value={`${lifetimeStats.spentPoints.toLocaleString()} pts`} theme={theme} last={true} />
        </View>
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
        {u.birthday ? (
          <AccountTile
            label={t("birthday", "Birthday")}
            value={new Date(u.birthday).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          />
        ) : null}
      </View>

      <SectionTitle title={t("badges", "Badges")} action={t("all", "All")} onPress={() => router.push("/badges")} />
      <Pressable onPress={() => router.push("/badges")}>
        {badges.length === 0 ? (
          <View style={[s.infoCard, { padding: 20, alignItems: "center", marginBottom: 20 }]}>
            <Text style={{ color: pass.textMid, fontSize: 13, textAlign: "center" }}>
              {t("noBadgesYet", "Earn your first badge by checking in or scanning a receipt")}
            </Text>
          </View>
        ) : (
          <View style={s.badgeGrid}>
            {badges.slice(0, 6).map((b) => (
              <View key={b.id} style={s.badgeCard}>
                <Text style={s.badgeIcon}>{b.iconUrl}</Text>
                <Text style={[s.badgeName, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{b.name}</Text>
                <Text style={s.badgeRarity}>{b.rarity}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      <SectionTitle title={t("network", "Network")} action={t("details", "Details")} onPress={() => router.push("/referrals")} />
      <View style={s.referralCard}>
        <Text style={[s.referralLabel, { fontFamily: fonts.bodyBold }]}>
          {t("referralCode", "Referral code").toUpperCase()}
        </Text>
        <Text style={[s.referralCode, { fontFamily: fonts.displayHeavy }]}>{u.referralCode}</Text>
        <Text style={s.referralHint}>{t("referralHintShort", "Friends +50 · You +100 after first buy")}</Text>
        <Text onPress={() => router.push("/referrals")} style={s.refsCount}>
          {t("referralsCount", "{{count}} referred", { count: referralsCount })} · {friendsCount} {t("friends", "friends")} →
        </Text>
      </View>

      <SectionTitle title={t("recentRewards", "Recent rewards")} action={t("rewards", "Rewards")} onPress={() => router.push("/rewards")} />
      <View style={s.infoCard}>
        {recentRedemptions.length === 0 ? (
          <View style={s.emptyHistory}>
            <Text style={[s.emptyHistoryText, { color: pass.textMid }]}>
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
      </View>

      <SectionTitle title={t("settings", "Settings")} />
      <View style={[s.infoCard, { padding: 14, marginBottom: 20 }]}>
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
                    <Text style={[s.cityChipText, { color: active ? pass.textLight : pass.textDark, fontFamily: fonts.bodyBold }]}>
                      {city.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Field label={t("birthday", "Birthday")} value={editBirthday} onChangeText={setEditBirthday} theme={theme} placeholder="YYYY-MM-DD" />
            <Text style={[s.fieldLabel, { color: pass.textMid, fontFamily: fonts.bodyBold, marginBottom: 8 }]}>
              {t("chooseAvatar", "Avatar color")}
            </Text>
            <View style={s.avatarRow}>
              {AVATAR_COLORS.map((color, i) => (
                <Pressable
                  key={color}
                  onPress={() => setEditAvatarColor(i)}
                  style={[s.avatarDot, { backgroundColor: color, borderWidth: editAvatarColor === i ? 3 : 2 }]}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
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
      </View>

      {/* Language */}
      <Text style={[s.h2, { color: pass.textDark, fontFamily: fonts.displayHeavy }]}>
        {t("language", "Language")}
      </Text>
      <View style={s.langRow}>
        {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => {
          const active = currentLng === lng
          return (
            <Pressable
              key={lng}
              onPress={() => changeLanguage(lng)}
              style={[s.langChip, { flex: 1, backgroundColor: active ? pass.orange : "#FFFFFF", borderColor: pass.border }]}
            >
              <Text style={[s.langChipActive, { fontFamily: fonts.bodyBold, color: active ? pass.textLight : pass.textDark }]}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Sign out */}
      <Pressable onPress={signOut} style={[s.signOut, { backgroundColor: "#FFFFFF" }]}>
        <Text style={[s.signOutText, { fontFamily: fonts.bodyBold }]}>{t("signOut", "Sign out")}</Text>
      </Pressable>
    </ScrollView>
  )
}

// ── helpers ───────────────────────────────────────────────────

function PassStatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[s.statTile, { backgroundColor: "#FFFFFF", borderColor: pass.border, borderWidth: 3 }]}>
      <Text style={[s.statValue, { color: accent, fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={[s.statLabel, { color: pass.textMid }]}>{label.toUpperCase()}</Text>
    </View>
  )
}

function QuickAction({
  icon, label, sub, tone, onPress,
}: { icon: string; label: string; sub: string; tone: "orange" | "dark" | "mint" | "white"; onPress: () => void }) {
  const bg = tone === "orange" ? pass.orange
    : tone === "dark" ? pass.mint
    : tone === "mint" ? pass.mint
    : "#FFFFFF"
  const isBlue = tone === "orange"
  const iconColor = pass.textDark
  const labelColor = isBlue ? pass.textLight : pass.textDark
  const subColor = isBlue ? pass.textLight : pass.textMid

  return (
    <Pressable onPress={onPress} style={s.quickPressable}>
      <View style={[s.quickCard, { backgroundColor: bg }]}>
        <View style={s.quickIcon}>
          <Text style={[s.quickIconText, { color: iconColor, fontFamily: fonts.displayHeavy }]}>{icon}</Text>
        </View>
        <Text style={[s.quickLabel, { color: labelColor, fontFamily: fonts.bodyBold }]} numberOfLines={1}>{label}</Text>
        <Text style={[s.quickSub, { color: subColor }]} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  )
}

function AccountTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.accountTile}>
      <Text style={[s.accountLabel, { fontFamily: fonts.bodyBold }]}>{label.toUpperCase()}</Text>
      <Text style={[s.accountValue, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.h2, { fontFamily: fonts.displayHeavy }]}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress} style={s.sectionAction}>
          <Text style={[s.sectionActionText, { fontFamily: fonts.bodyBold }]}>{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Row({ label, value, theme: _theme, last }: { label: string; value: string; theme: Theme; last: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomColor: pass.border, borderBottomWidth: 1 }]}>
      <Text style={{ color: pass.textMid, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: pass.textDark, fontSize: 14, fontFamily: fonts.bodyBold }}>{value}</Text>
    </View>
  )
}

function Field({
  label, value, onChangeText, theme: _theme, placeholder,
}: { label: string; value: string; onChangeText: (v: string) => void; theme: Theme; placeholder?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: pass.textMid, fontSize: 10, fontFamily: fonts.bodyBold, letterSpacing: 1, marginBottom: 6 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 6, borderWidth: 2, borderColor: pass.border }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          style={{ padding: 12, fontSize: 14, color: pass.textDark, fontFamily: fonts.body }}
          placeholderTextColor={pass.textMuted}
        />
      </View>
    </View>
  )
}

function Btn({
  label, onPress, variant = "primary", disabled,
}: { label: string; onPress: () => void; variant?: "primary" | "ghost"; disabled?: boolean }) {
  const bg = variant === "primary" ? pass.orange : "#FFFFFF"
  const textColor = variant === "primary" ? pass.textLight : pass.textDark
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 6,
        alignItems: "center",
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        borderWidth: 2,
        borderColor: pass.border,
      }}
    >
      <Text style={{ color: textColor, fontFamily: fonts.bodyBold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 16, paddingBottom: 116 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Screen header
  screenHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  kicker: { color: pass.textMuted, fontSize: 10, letterSpacing: 2 },
  screenTitle: { color: pass.textDark, fontSize: 28, lineHeight: 32, letterSpacing: 0 },
  headButton: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: pass.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: pass.border,
  },
  headButtonText: { color: pass.textLight, fontSize: 18 },

  // Physical Pass Hero
  passHero: { marginBottom: 24 },
  passHeroTop: {
    backgroundColor: pass.mint,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: pass.border,
    padding: 20,
    paddingBottom: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  passHeroHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  passAvatar: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: pass.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: pass.border,
  },
  passAvatarText: { color: pass.textLight, fontSize: 22 },
  passHeroLabel: { color: pass.textDark, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  passHeroName: { color: pass.textDark, fontSize: 18, lineHeight: 21 },
  passHeroCity: { color: pass.textDark, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  passRefBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: pass.border,
  },
  passRefBadgeText: { color: pass.textDark, fontSize: 11, letterSpacing: 1.5 },
  passIdStrip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: pass.border,
  },
  passIdLabel: { color: pass.textDark, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  passIdNumber: { color: pass.textDark, fontSize: 16, letterSpacing: 1.5 },
  passBalance: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 18 },
  passBalanceLabel: { color: pass.textDark, fontSize: 9, letterSpacing: 1.5, marginBottom: 4 },
  passBalanceValue: { color: pass.textDark, fontSize: 52, lineHeight: 52, letterSpacing: 0 },
  passBalanceSub: { color: pass.textDark, fontSize: 14, marginBottom: 6 },
  passBalanceSplit: { gap: 8 },
  passBalanceChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    borderWidth: 2,
    borderColor: pass.border,
  },
  passBalanceChipValue: { color: pass.textDark, fontSize: 15, lineHeight: 17 },
  passBalanceChipLabel: { color: pass.textDark, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  passProgress: { gap: 6 },
  passProgressTrack: {
    height: 10,
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: pass.border,
  },
  passProgressFill: { height: "100%", backgroundColor: pass.orange, borderRadius: 0 },
  passProgressLabel: { color: pass.textDark, fontSize: 9, letterSpacing: 0.5 },
  passHeroBottom: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: pass.border,
    padding: 16,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  passQrSection: { flexDirection: "row", gap: 14, alignItems: "center" },
  passQrBox: {
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 2,
    borderColor: pass.border,
  },
  passQrHint: { color: pass.textMid, fontSize: 12, lineHeight: 16, flex: 1 },
  passQrBtn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: pass.border,
  },
  passQrBtnOrange: { backgroundColor: pass.orange },
  passQrBtnText: { color: pass.textDark, fontSize: 12 },
  passQrBtnTextBlue: { color: pass.textLight },

  // Quick actions
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 18 },
  quickPressable: { width: "48.5%" },
  quickCard: {
    padding: 14,
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: pass.border,
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: pass.border,
  },
  quickIconText: { fontSize: 18 },
  quickLabel: { fontSize: 13 },
  quickSub: { fontSize: 11, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  statTile: {
    flex: 1,
    padding: 14,
    minHeight: 72,
    borderRadius: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statValue: { fontSize: 21, lineHeight: 23 },
  statLabel: { fontSize: 9, marginTop: 4, letterSpacing: 0.8, fontWeight: "700" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },

  // Section header
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  h2: { color: pass.textDark, fontSize: 22 },
  sectionAction: {
    backgroundColor: pass.orange,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: pass.border,
  },
  sectionActionText: { color: pass.textLight, fontSize: 11 },

  // Info / cards
  infoCard: {
    marginBottom: 18,
    padding: 0,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: pass.border,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  accountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 18 },
  accountTile: {
    width: "48.5%",
    padding: 14,
    minHeight: 80,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: pass.border,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  accountLabel: { color: pass.textMuted, fontSize: 9, letterSpacing: 0.8 },
  accountValue: { color: pass.textDark, fontSize: 17, marginTop: 8 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 18 },
  badgeCard: {
    width: "31.4%",
    padding: 11,
    alignItems: "center",
    minHeight: 92,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: pass.border,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  badgeIcon: { fontSize: 24, marginBottom: 5 },
  badgeName: { color: pass.textDark, fontSize: 12 },
  badgeRarity: { color: pass.textMuted, fontSize: 9, marginTop: 2, letterSpacing: 0.5 },

  referralCard: {
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: pass.orange,
    borderWidth: 3,
    borderColor: pass.border,
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  referralLabel: { color: pass.textLight, fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  referralCode: { color: pass.textLight, fontSize: 26, letterSpacing: 4 },
  referralHint: { color: pass.textLight, fontSize: 11, marginTop: 6, textAlign: "center" },
  refsCount: { color: pass.textLight, fontSize: 12, fontWeight: "700", marginTop: 14 },
  emptyHistory: { padding: 18, alignItems: "center" },
  emptyHistoryText: { fontSize: 13, textAlign: "center" },

  fieldLabel: { fontSize: 11, letterSpacing: 0.5 },
  avatarRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  avatarDot: { width: 32, height: 32, borderRadius: 4, borderWidth: 2, borderColor: pass.border },

  cityRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  cityChip: { flex: 1, borderRadius: 4, paddingVertical: 10, alignItems: "center", borderWidth: 2, borderColor: pass.border },
  cityChipActive: { backgroundColor: pass.orange },
  cityChipIdle: { backgroundColor: "#FFFFFF" },
  cityChipText: { fontSize: 12 },

  langRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  langChip: { paddingVertical: 12, borderRadius: 4, alignItems: "center", borderWidth: 2 },
  langChipText: { fontSize: 13 },
  langChipActive: { fontSize: 13 },

  signOut: { padding: 14, borderRadius: 6, alignItems: "center", borderWidth: 2, borderColor: pass.border },
  signOutText: { color: "#000000", fontSize: 14 },
})
