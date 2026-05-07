import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../src/lib/theme"
import { LavaLampSurface } from "../../src/components/neu"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

type RewardItem = {
  id: string
  title: string
  pointsCost: number
  venue: { id: string; name: string }
}

function fmt(n: number) {
  return n.toLocaleString()
}

function daysLeft(d: Date | string | null | undefined): number {
  if (!d) return 0
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000))
}

function initials(name: string | null | undefined) {
  return (name ?? "P").slice(0, 1).toUpperCase()
}

export default function HomeScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation(["common", "venue"])

  const [activeFilterKey, setActiveFilterKey] = useState("all")
  const me = trpc.user.me.useQuery()
  const utils = trpc.useUtils()
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const rewards = trpc.reward.list.useQuery({ limit: 8 })
  const selectedCity = resolveCity(me.data?.homeCity)
  const activeFilter = VENUE_FILTERS.find((filter) => filter.key === activeFilterKey) ?? DEFAULT_VENUE_FILTER
  const nearby = trpc.venue.nearby.useQuery({
    lat: selectedCity.lat,
    lng: selectedCity.lng,
    radiusKm: selectedCity.radiusKm,
    ...(activeFilter.category ? { category: activeFilter.category } : {}),
    limit: 8,
  })
  const challenges = trpc.challenge.listMine.useQuery()

  const rewardItems = (rewards.data?.rewards ?? []) as RewardItem[]
  const activeChallenges = (challenges.data ?? []).filter((uc) => !uc.isCompleted)
  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.topBar}>
        <CircleButton label="+" onPress={() => router.push("/earn")} />
        <View style={s.helloBlock}>
          <Text style={[s.kicker, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>PULSE</Text>
          <Text style={[s.hello, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("hiName", { name: me.data?.name?.split(" ")[0] ?? "Demo" })}
          </Text>
          <View style={s.citySwitch}>
            {CITY_OPTIONS.map((city) => {
              const active = selectedCity.name === city.name
              return (
                <Pressable
                  key={city.name}
                  onPress={() => updateProfile.mutate({ homeCity: city.name })}
                  style={[s.cityPill, active ? s.cityPillActive : s.cityPillIdle]}
                >
                  <Text style={[s.cityPillText, { color: active ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
                    ⌖ {city.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
        <CircleButton label="◦" onPress={() => router.push("/profile")} />
      </View>

      <View style={[s.dashboard, theme.shadowRaised]}>
        <View style={s.dashboardGlowTop} />
        <View style={s.dashboardGlowBottom} />

        <View style={s.profileRow}>
          <LavaLampSurface style={s.profileAvatar}>
            <Text style={[s.profileAvatarText, { fontFamily: fonts.displayHeavy }]}>
              {initials(me.data?.name)}
            </Text>
          </LavaLampSurface>
          <View style={s.profileMain}>
            <Text style={[s.profileName, { fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
              {me.data?.name ?? "Demo User"}
            </Text>
            <View style={s.profileStats}>
              <Text style={s.profileStat}>▣ {fmt(total)}</Text>
              <Text style={s.profileStat}>◌ {activeChallenges.length}</Text>
              <Text style={s.profileStat}>☆ {welcomeDays}d</Text>
            </View>
          </View>
          <View style={s.profileIcon}>
            <Text style={s.profileIconText}>⌘</Text>
          </View>
        </View>

        <View style={s.levelSplit}>
          <View style={s.levelPaneLight}>
            <Text style={[s.levelValueDark, { fontFamily: fonts.displayHeavy }]}>{fmt(me.data?.earnedPoints ?? 0)}</Text>
            <Text style={[s.levelLabelDark, { fontFamily: fonts.bodyBold }]}>Earned{"\n"}Points</Text>
          </View>
          <View style={s.levelPaneBlue}>
            <Text style={[s.levelValueLight, { fontFamily: fonts.displayHeavy }]}>{fmt(me.data?.welcomePoints ?? 0)}</Text>
            <Text style={[s.levelLabelLight, { fontFamily: fonts.bodyBold }]}>Welcome{"\n"}Points</Text>
          </View>
        </View>

        <View style={s.dashboardSectionHead}>
          <Text style={[s.dashboardSectionTitle, { fontFamily: fonts.displayHeavy }]}>Popular rewards</Text>
          <Text style={[s.dashboardSectionLink, { fontFamily: fonts.bodyBold }]}>See all ›</Text>
        </View>

        <View style={s.rewardProgressCard}>
          <View style={s.rewardProgressTop}>
            <View>
              <Text style={[s.rewardProgressTitle, { fontFamily: fonts.displayHeavy }]}>Scan, visit, redeem</Text>
              <Text style={s.rewardProgressSub}>Choose your level and get started today.</Text>
            </View>
            <View style={s.rewardProgressButton}>
              <Text style={s.rewardProgressButtonText}>⌃</Text>
            </View>
          </View>
          <Text style={[s.rewardProgressLabel, { fontFamily: fonts.bodyBold }]}>Levels:</Text>
          <View style={s.levelBlocks}>
            {["01", "02", "03", "04", "05", "06"].map((level, index) => (
              <View key={level} style={[s.levelBlock, index > 3 && s.levelBlockFuture]}>
                <Text style={s.levelCheck}>{index < 4 ? "✓" : ""}</Text>
                <Text style={[s.levelBlockText, { fontFamily: fonts.bodyBold }]}>{level}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={() => router.push("/rewards")} style={s.blueRewardPill}>
          <Text style={[s.blueRewardText, { fontFamily: fonts.displayHeavy }]}>Special offers</Text>
          <View style={s.blueRewardIcon}>
            <Text style={s.blueRewardIconText}>⌄</Text>
          </View>
        </Pressable>
      </View>

      <View style={s.quickStatsPanel}>
        <View style={s.quickStat}>
          <Text style={[s.quickStatValue, { fontFamily: fonts.displayHeavy }]}>{`${me.data?.currentStreak ?? 0}d`}</Text>
          <Text style={[s.quickStatLabel, { fontFamily: fonts.bodyBold }]}>{t("streakLabel")}</Text>
        </View>
        <View style={s.quickStat}>
          <Text style={[s.quickStatValue, { fontFamily: fonts.displayHeavy }]}>{`${welcomeDays}d`}</Text>
          <Text style={[s.quickStatLabel, { fontFamily: fonts.bodyBold }]}>{t("welcomeLeft")}</Text>
        </View>
        <View style={s.quickStat}>
          <Text style={[s.quickStatValue, { fontFamily: fonts.displayHeavy }]}>{activeChallenges.length}</Text>
          <Text style={[s.quickStatLabel, { fontFamily: fonts.bodyBold }]}>{t("quests")}</Text>
        </View>
      </View>

      <View style={s.actionRow}>
        <ActionPill label={t("scanReceipt")} icon="⌁" onPress={() => router.push("/scan")} dark />
        <ActionPill label={t("checkIn")} icon="⌖" onPress={() => router.push("/checkin")} />
      </View>

      <SectionHeader title={t("specialOffers")} action={t("allRewards")} onPress={() => router.push("/rewards")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.offerRail}>
        {rewardItems.slice(0, 6).map((reward, index) => (
          <OfferCard
            key={reward.id}
            title={reward.title}
            venue={reward.venue.name}
            points={reward.pointsCost}
            pointsLabel={t("pointsUnit")}
            openLabel={t("open")}
            featured={index === 0}
            onPress={() => router.push({ pathname: "/reward/[id]", params: { id: reward.id } })}
          />
        ))}
      </ScrollView>

      <SectionHeader title={t("venuesNearby")} action={t("nav.map")} onPress={() => router.push("/map")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
        {VENUE_FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilterKey(filter.key)}
            style={[s.filterChip, filter.key === activeFilterKey ? s.filterChipActive : s.filterChipIdle]}
          >
            <Text style={[s.filterChipText, { color: filter.key === activeFilterKey ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.venueList}>
        {nearby.isLoading ? (
          <>
            <VenueSkeleton />
            <VenueSkeleton />
          </>
        ) : null}
        {!nearby.isLoading && nearby.data?.length === 0 ? (
          <View style={s.emptyVenues}>
            <Text style={[s.emptyVenuesText, { fontFamily: fonts.bodyBold }]}>
              {selectedCity.label}: {t("venue:noVenuesYet", "No venues yet")}
            </Text>
          </View>
        ) : null}
        {(nearby.data ?? []).slice(0, 5).map((venue) => {
          const offer = rewardItems.find((reward) => reward.venue.id === venue.id)
          return (
            <VenueCard
              key={venue.id}
              name={venue.name}
              category={t(`venue:category.${venue.category}`, venue.category.toLowerCase())}
              city={venue.city}
              address={venue.address}
              rate={venue.pointsPerCurrency ?? null}
              offer={offer?.title ?? t("partnerPoints")}
              logo={initials(venue.name)}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
              receiptScanLabel={t("receiptScan")}
              menuLabel={t("menu")}
              routeLabel={t("route")}
            />
          )
        })}
      </View>
    </ScrollView>
  )
}

function CircleButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.circleButton}>
      <Text style={s.circleButtonText}>{label}</Text>
    </Pressable>
  )
}

function MetricCard({ value, label, tone }: { value: string; label: string; tone: "cyan" | "white" | "black" }) {
  const bg = tone === "cyan" ? colors.cyan : tone === "black" ? colors.lavaBase : "#FFFFFF"
  const fg = tone === "black" ? "#FFFFFF" : colors.ink
  const content = (
    <>
      <Text style={[s.metricValue, { color: fg, fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: tone === "black" ? "rgba(255,255,255,0.82)" : "#7A808E", fontFamily: fonts.bodyBold }]}>
        {label.toUpperCase()}
      </Text>
    </>
  )

  if (tone === "black") {
    return (
      <LavaLampSurface style={s.metricCard} contentStyle={s.metricCardContent}>
        {content}
      </LavaLampSurface>
    )
  }

  return (
    <View style={[s.metricCard, { backgroundColor: bg }]}>{content}</View>
  )
}

function ActionPill({ label, icon, onPress, dark }: { label: string; icon: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.actionPill, dark ? s.actionPillDark : s.actionPillLight]}>
      {dark ? <LavaLampSurface style={StyleSheet.absoluteFill} /> : null}
      <View style={[s.actionIcon, dark ? s.actionIconDark : s.actionIconLight]}>
        <Text style={[s.actionIconText, { color: dark ? colors.lavaPink : "#FFFFFF" }]}>{icon}</Text>
      </View>
      <Text style={[s.actionLabel, { color: dark ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { fontFamily: fonts.displayHeavy }]}>{title}</Text>
      <Pressable onPress={onPress} style={s.sectionButton}>
        <Text style={[s.sectionButtonText, { fontFamily: fonts.bodyBold }]}>{action}</Text>
      </Pressable>
    </View>
  )
}

function OfferCard({
  title,
  venue,
  points,
  pointsLabel,
  openLabel,
  featured,
  onPress,
}: {
  title: string
  venue: string
  points: number
  pointsLabel: string
  openLabel: string
  featured: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={s.offerPressable}>
      {featured ? (
        <View style={[s.offerCard, s.offerCardFeatured]}>
          <OfferCardContent
            title={title}
            venue={venue}
            points={points}
            pointsLabel={pointsLabel}
            openLabel={openLabel}
            featured={featured}
          />
        </View>
      ) : (
        <LavaLampSurface style={s.offerCard}>
          <OfferCardContent
            title={title}
            venue={venue}
            points={points}
            pointsLabel={pointsLabel}
            openLabel={openLabel}
            featured={featured}
          />
        </LavaLampSurface>
      )}
    </Pressable>
  )
}

function OfferCardContent({
  title,
  venue,
  points,
  pointsLabel,
  openLabel,
  featured,
}: {
  title: string
  venue: string
  points: number
  pointsLabel: string
  openLabel: string
  featured: boolean
}) {
  return (
    <>
      <View style={s.offerTop}>
        <View style={[s.offerLogo, featured ? s.offerLogoDark : s.offerLogoLight]}>
          <Text style={[s.offerLogoText, { color: featured ? "#FFFFFF" : colors.ink }]}>✦</Text>
        </View>
        <Text style={[s.offerPoints, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>
          {points} {pointsLabel}
        </Text>
      </View>
      <Text style={[s.offerTitle, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[s.offerVenue, { color: featured ? "#5A606C" : "rgba(255,255,255,0.62)", fontFamily: fonts.bodyBold }]} numberOfLines={1}>
        {venue}
      </Text>
      <View style={[s.offerLink, featured ? s.offerLinkLight : s.offerLinkDark]}>
        <Text style={[s.offerLinkText, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>{openLabel} ↗</Text>
      </View>
    </>
  )
}

function VenueCard({
  name,
  category,
  city,
  address,
  rate,
  offer,
  logo,
  onPress,
  receiptScanLabel,
  menuLabel,
  routeLabel,
}: {
  name: string
  category: string
  city: string
  address: string
  rate: number | null
  offer: string
  logo: string
  onPress: () => void
  receiptScanLabel: string
  menuLabel: string
  routeLabel: string
}) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} style={[s.venueCard, theme.shadowRaisedSm]}>
      <View style={s.venueLogo}>
        <Text style={[s.venueLogoText, { fontFamily: fonts.displayHeavy }]}>{logo}</Text>
      </View>
      <View style={s.venueMain}>
        <View style={s.venueTitleRow}>
          <Text style={[s.venueName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{name}</Text>
          <Text style={s.venueArrow}>↗</Text>
        </View>
        <Text style={[s.venueMeta, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {category} · {city}
        </Text>
        <Text style={s.venueAddress} numberOfLines={1}>{address}</Text>
        <View style={s.venueChips}>
          <View style={s.venueChipDark}>
            <Text style={[s.venueChipDarkText, { fontFamily: fonts.bodyBold }]}>
              {rate ? `${rate.toFixed(3)} pts/RSD` : receiptScanLabel}
            </Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{menuLabel}</Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{routeLabel}</Text>
          </View>
        </View>
        <View style={s.specialLine}>
          <Text style={s.specialDot}>●</Text>
          <Text style={[s.specialText, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{offer}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function VenueSkeleton() {
  return (
    <View style={s.venueSkeleton}>
      <View style={s.skeletonLogo} />
      <View style={s.skeletonMain}>
        <View style={s.skeletonLineWide} />
        <View style={s.skeletonLine} />
        <View style={s.skeletonChips}>
          <View style={s.skeletonChip} />
          <View style={s.skeletonChip} />
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  helloBlock: { flex: 1 },
  kicker: { fontSize: 11, letterSpacing: 1.8 },
  hello: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  citySwitch: { flexDirection: "row", gap: 7, marginTop: 6 },
  cityPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  cityPillActive: { backgroundColor: colors.lavaBase },
  cityPillIdle: { backgroundColor: "#FFFFFF" },
  cityPillText: { fontSize: 10 },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(5,6,10,0.06)",
  },
  circleButtonText: { color: colors.ink, fontSize: 25, lineHeight: 27 },

  dashboard: { borderRadius: 34, padding: 16, marginBottom: 12, overflow: "hidden", backgroundColor: "#0A0B0F" },
  dashboardGlowTop: {
    position: "absolute",
    top: -92,
    left: 18,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255,154,34,0.22)",
  },
  dashboardGlowBottom: {
    position: "absolute",
    right: -56,
    bottom: 100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(122,221,243,0.16)",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  profileAvatar: { width: 70, height: 70, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: "#FFFFFF", fontSize: 28 },
  profileMain: { flex: 1 },
  profileName: { color: "#FFFFFF", fontSize: 26, lineHeight: 28, letterSpacing: 0 },
  profileStats: { flexDirection: "row", gap: 14, marginTop: 8 },
  profileStat: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" },
  profileIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  profileIconText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  levelSplit: { flexDirection: "row", borderRadius: 25, overflow: "hidden", marginBottom: 16 },
  levelPaneLight: { flex: 1, minHeight: 104, backgroundColor: "#FFFFFF", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  levelPaneBlue: { flex: 1, minHeight: 104, backgroundColor: colors.lavaBlue, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  levelValueDark: { color: "#1F242B", fontSize: 50, lineHeight: 54, letterSpacing: 0 },
  levelValueLight: { color: "#FFFFFF", fontSize: 50, lineHeight: 54, letterSpacing: 0 },
  levelLabelDark: { color: "#1F242B", fontSize: 13, lineHeight: 14 },
  levelLabelLight: { color: "#FFFFFF", fontSize: 13, lineHeight: 14 },
  dashboardSectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  dashboardSectionTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 28, letterSpacing: 0 },
  dashboardSectionLink: { color: "rgba(255,255,255,0.72)", fontSize: 11 },
  rewardProgressCard: { backgroundColor: colors.lavaBase, borderRadius: 25, padding: 12, minHeight: 184, overflow: "hidden" },
  rewardProgressTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rewardProgressTitle: { color: "#FFFFFF", fontSize: 19, lineHeight: 22, letterSpacing: 0 },
  rewardProgressSub: { color: "rgba(30,16,12,0.74)", fontSize: 11, marginTop: 5, maxWidth: 190 },
  rewardProgressButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  rewardProgressButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  rewardProgressLabel: { color: "#FFFFFF", fontSize: 12, marginTop: 12 },
  levelBlocks: { flexDirection: "row", gap: 7, marginTop: 8 },
  levelBlock: { flex: 1, minHeight: 82, borderRadius: 12, backgroundColor: "rgba(123,22,8,0.48)", padding: 7, justifyContent: "space-between" },
  levelBlockFuture: { backgroundColor: "rgba(255,255,255,0.20)" },
  levelCheck: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", minHeight: 18 },
  levelBlockText: { color: "#FFFFFF", fontSize: 12, textAlign: "center" },
  blueRewardPill: { marginTop: 12, minHeight: 68, borderRadius: 22, backgroundColor: colors.lavaBlue, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blueRewardText: { color: "#FFFFFF", fontSize: 20, letterSpacing: 0 },
  blueRewardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.16)", alignItems: "center", justifyContent: "center" },
  blueRewardIconText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  quickStatsPanel: { flexDirection: "row", gap: 0, marginBottom: 12, backgroundColor: "#FFFFFF", borderRadius: 24, overflow: "hidden" },
  quickStat: { flex: 1, minHeight: 82, justifyContent: "center", alignItems: "center" },
  quickStatValue: { color: "#1F242B", fontSize: 30, lineHeight: 32, letterSpacing: 0 },
  quickStatLabel: { color: "#626875", fontSize: 9, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },

  metrics: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, borderRadius: 24, padding: 13, minHeight: 82, justifyContent: "center" },
  metricCardContent: { flex: 1, justifyContent: "center" },
  metricValue: { fontSize: 26, lineHeight: 28, letterSpacing: 0 },
  metricLabel: { fontSize: 9, marginTop: 5, letterSpacing: 0.8 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  actionPill: { flex: 1, borderRadius: 99, padding: 7, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" },
  actionPillDark: { backgroundColor: colors.lavaBase },
  actionPillLight: { backgroundColor: "#FFFFFF" },
  actionIcon: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  actionIconDark: { backgroundColor: "#FFFFFF" },
  actionIconLight: { backgroundColor: colors.lavaPink },
  actionIconText: { fontSize: 16, fontWeight: "900" },
  actionLabel: { fontSize: 13 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 25, letterSpacing: 0 },
  sectionButton: { backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  sectionButtonText: { color: colors.ink, fontSize: 11 },
  filterRail: { gap: 8, paddingBottom: 12 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: colors.lavaBase },
  filterChipIdle: { backgroundColor: "#FFFFFF" },
  filterChipText: { fontSize: 11 },
  offerRail: { gap: 12, paddingBottom: 20 },
  offerPressable: { width: 176 },
  offerCard: { minHeight: 174, borderRadius: 30, padding: 14, overflow: "hidden" },
  offerCardFeatured: { backgroundColor: colors.cyan },
  offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  offerLogo: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  offerLogoDark: { backgroundColor: colors.lavaPink },
  offerLogoLight: { backgroundColor: "#FFFFFF" },
  offerLogoText: { fontSize: 17, fontWeight: "900" },
  offerPoints: { backgroundColor: "rgba(255,255,255,0.28)", color: "#FFFFFF", borderRadius: 99, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  offerTitle: { fontSize: 21, lineHeight: 23, letterSpacing: 0, minHeight: 48 },
  offerVenue: { fontSize: 12, marginTop: 8 },
  offerLink: { marginTop: "auto", alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  offerLinkLight: { backgroundColor: "rgba(255,255,255,0.72)" },
  offerLinkDark: { backgroundColor: "rgba(255,255,255,0.14)" },
  offerLinkText: { fontSize: 12 },

  venueList: { gap: 12 },
  emptyVenues: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, alignItems: "center" },
  emptyVenuesText: { color: "#8E95A3", fontSize: 12 },
  venueSkeleton: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 12, flexDirection: "row", gap: 12 },
  skeletonLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "#EEF3FB" },
  skeletonMain: { flex: 1, justifyContent: "center", gap: 8 },
  skeletonLineWide: { height: 14, borderRadius: 7, backgroundColor: "#EEF3FB", width: "72%" },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: "#F4F7FC", width: "54%" },
  skeletonChips: { flexDirection: "row", gap: 6 },
  skeletonChip: { width: 72, height: 24, borderRadius: 12, backgroundColor: "#EEF3FB" },
  venueCard: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 12, flexDirection: "row", gap: 12 },
  venueLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "#EAF0FA", alignItems: "center", justifyContent: "center" },
  venueLogoText: { color: colors.ink, fontSize: 22 },
  venueMain: { flex: 1 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  venueName: { color: colors.ink, fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8, letterSpacing: 0 },
  venueArrow: { color: colors.ink, fontSize: 22 },
  venueMeta: { color: "#6B7280", fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  venueAddress: { color: "#8E95A3", fontSize: 12, marginTop: 2 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  venueChipDark: { backgroundColor: colors.lavaBase, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipDarkText: { color: "#FFFFFF", fontSize: 10 },
  venueChipLight: { backgroundColor: "#EEF3FB", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipLightText: { color: colors.ink, fontSize: 10 },
  specialLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "#F3F7FF", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  specialDot: { color: colors.skySolid, fontSize: 10 },
  specialText: { color: colors.ink, fontSize: 12, flex: 1 },
})
