import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../src/lib/theme"
import { LavaLampSurface } from "../../src/components/neu"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

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

function distanceLabel(meters: number | null | undefined) {
  if (meters === null || meters === undefined) return "Nearby"
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function ratingLabel(rating: number | null | undefined, reviews: number | null | undefined) {
  if (!rating) return "Google soon"
  return `Google ${rating.toFixed(1)} · ${reviews ?? 0}`
}

function initials(name: string | null | undefined) {
  return (name ?? "P").slice(0, 1).toUpperCase()
}

function userTier(points: number) {
  if (points <= 1000) return { name: "Росток", kind: "sprout", next: 1000, start: 0, colors: ["#ECFFEB", "#9FEED3", "#F9FBFF"] as const }
  if (points <= 3000) return { name: "Цветок", kind: "flower", next: 3000, start: 1001, colors: ["#FFF4FE", "#F199E3", "#F9FBFF"] as const }
  if (points <= 5000) return { name: "Гранат", kind: "pomegranate", next: 5000, start: 3001, colors: ["#FFF4FE", "#FF8B8B", "#F9FBFF"] as const }
  if (points <= 7000) return { name: "Рубин", kind: "ruby", next: 7000, start: 5001, colors: ["#F9FBFF", "#F199E3", "#9DCCFF"] as const }
  return { name: "Бриллиант", kind: "diamond", next: 10000, start: 7001, colors: ["#EBFEFF", "#9DCCFF", "#FFFFFF"] as const }
}

function tierProgress(points: number, start: number, next: number) {
  return Math.max(0.08, Math.min(1, (points - start) / Math.max(1, next - start)))
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
  const visibleNearby = nearby.data?.length ? nearby.data : getDemoVenues(selectedCity.name, activeFilter)
  const activeChallenges = (challenges.data ?? []).filter((uc) => !uc.isCompleted)
  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const lifetimePoints = Math.max(me.data?.totalEarnedLifetime ?? 0, total + (me.data?.spentPoints ?? 0))
  const tier = userTier(lifetimePoints)
  const progress = tierProgress(lifetimePoints, tier.start, tier.next)
  const weeklyEarned = me.data?.weeklyEarnedPoints ?? 15
  const weeklySpent = me.data?.weeklySpentPoints ?? 10
  const todayAvailable = Math.max(0, 100 - (weeklyEarned % 100))
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.topBar}>
        <CircleButton label="+" onPress={() => router.push("/earn")} />
        <View style={s.helloBlock}>
          <Text style={[s.kicker, { color: theme.textMuted, fontFamily: fonts.bodyBold }]}>PULSE</Text>
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
                  <Text style={[s.cityPillText, { color: active ? "#7A8EA3" : theme.textMuted, fontFamily: fonts.bodyBold }]}>
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
        <ProgressOrb points={lifetimePoints} tier={tier} progress={progress} />

        <View style={s.profileRow}>
          <LavaLampSurface style={s.profileAvatar}>
            <Text style={[s.profileAvatarText, { fontFamily: fonts.displayHeavy }]}>
              {initials(me.data?.name)}
            </Text>
          </LavaLampSurface>
          <View style={s.profileMain}>
            <Text style={[s.profileName, { fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
              {fmt(total)} pts
            </Text>
            <View style={s.profileStats}>
              <Text style={s.profileStat}>active balance</Text>
            </View>
          </View>
          <View style={s.profileIcon}>
            <Text style={s.profileIconText}>⌘</Text>
          </View>
        </View>

        <View style={s.levelSplit}>
          <View style={s.levelPaneLight}>
            <Text style={[s.levelValueDark, s.weekGain, { fontFamily: fonts.displayHeavy }]}>+{fmt(weeklyEarned)}</Text>
            <Text style={[s.levelLabelDark, { fontFamily: fonts.bodyBold }]}>earned{"\n"}this week</Text>
          </View>
          <View style={s.levelPaneBlue}>
            <Text style={[s.levelValueLight, s.weekSpend, { fontFamily: fonts.displayHeavy }]}>-{fmt(weeklySpent)}</Text>
            <Text style={[s.levelLabelLight, { fontFamily: fonts.bodyBold }]}>spent{"\n"}this week</Text>
          </View>
        </View>

        <BalancePanel
          total={lifetimePoints}
          available={total}
          today={todayAvailable}
          onToday={() => router.push("/earn")}
          onHistory={() => router.push("/points-history")}
          onShare={() => router.push("/gift")}
        />

        <View style={s.dashboardSectionHead}>
          <Text style={[s.dashboardSectionTitle, { fontFamily: fonts.displayHeavy }]}>Daily plan</Text>
          <Text style={[s.dashboardSectionLink, { fontFamily: fonts.bodyBold }]}>earn more ›</Text>
        </View>

        <LinearGradient
          colors={["#EBFEFF", "rgba(255,244,254,0.72)", "#ECFFEB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.rewardProgressCard}
        >
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
        </LinearGradient>

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

      <View style={s.modeTabs}>
        <Pressable onPress={() => router.push("/rewards")} style={[s.modeTab, s.modeTabLight]}>
          <Text style={[s.modeTabTextLight, { fontFamily: fonts.bodyBold }]}>Goals</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/rewards")} style={[s.modeTab, s.modeTabBlue]}>
          <Text style={[s.modeTabTextDark, { fontFamily: fonts.bodyBold }]}>Rewards</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/profile")} style={[s.modeTab, s.modeTabRed]}>
          <Text style={[s.modeTabTextDark, { fontFamily: fonts.bodyBold }]}>Support</Text>
        </Pressable>
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
            <Text style={[s.filterChipText, { color: filter.key === activeFilterKey ? "#7A8EA3" : colors.ink, fontFamily: fonts.bodyBold }]}>
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
        {!nearby.isLoading && visibleNearby.length === 0 ? (
          <View style={s.emptyVenues}>
            <Text style={[s.emptyVenuesText, { fontFamily: fonts.bodyBold }]}>
              {selectedCity.label}: {t("venue:noVenuesYet", "No venues yet")}
            </Text>
          </View>
        ) : null}
        {visibleNearby.slice(0, 5).map((venue) => {
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
              distance={venue.distanceMeters}
              rating={venue.googleRating}
              reviews={venue.googleReviews}
              discount={venue.enableDiscount ? venue.maxDiscountPercent : null}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
              receiptScanLabel={t("receiptScan")}
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
  const bg = tone === "cyan" ? colors.cyan : tone === "black" ? "rgba(255,244,254,0.92)" : "#FFFFFF"
  const fg = colors.ink
  const content = (
    <>
      <Text style={[s.metricValue, { color: fg, fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: "#91A1B4", fontFamily: fonts.bodyBold }]}>
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
      <Text style={[s.actionLabel, { color: colors.ink, fontFamily: fonts.bodyBold }]}>
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
        <View style={[s.offerCard, s.offerCardBlue]}>
          <OfferCardContent
            title={title}
            venue={venue}
            points={points}
            pointsLabel={pointsLabel}
            openLabel={openLabel}
            featured={featured}
          />
        </View>
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
        <Text style={[s.offerLogoText, { color: "#91A1B4" }]}>✦</Text>
        </View>
        <Text style={[s.offerPoints, { color: "#91A1B4", fontFamily: fonts.bodyBold }]}>
          {points} {pointsLabel}
        </Text>
      </View>
      <Text style={[s.offerTitle, { color: "#6E7D8E", fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[s.offerVenue, { color: "#91A1B4", fontFamily: fonts.bodyBold }]} numberOfLines={1}>
        {venue}
      </Text>
      <View style={s.offerLink}>
        <Text style={[s.offerLinkText, { color: "#91A1B4", fontFamily: fonts.bodyBold }]}>{openLabel} ↗</Text>
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
  distance,
  rating,
  reviews,
  discount,
  onPress,
  receiptScanLabel,
}: {
  name: string
  category: string
  city: string
  address: string
  rate: number | null
  offer: string
  logo: string
  distance: number
  rating: number | null
  reviews: number | null
  discount: number | null
  onPress: () => void
  receiptScanLabel: string
}) {
  return (
    <Pressable onPress={onPress} style={s.venueCard}>
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
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{distanceLabel(distance)}</Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{ratingLabel(rating, reviews)}</Text>
          </View>
          {discount ? (
            <View style={s.venueChipMint}>
              <Text style={[s.venueChipMintText, { fontFamily: fonts.bodyBold }]}>-{discount}%</Text>
            </View>
          ) : null}
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

function ProgressOrb({
  points,
  tier,
  progress,
}: {
  points: number
  tier: ReturnType<typeof userTier>
  progress: number
}) {
  return (
    <View style={s.progressOrbWrap}>
      <LavaLampSurface intensity="glass" style={s.progressOrbGlow} />
      <View style={s.progressOrb}>
        <LinearGradient
          colors={tier.colors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[s.progressOrbFill, { height: `${Math.round(progress * 100)}%` }]}
        />
        <View style={s.progressOrbShine} />
        <View style={s.tierBadge}>
          <TierMark kind={tier.kind} />
          <Text style={[s.tierName, { fontFamily: fonts.displayHeavy }]}>{tier.name}</Text>
          <Text style={[s.tierPoints, { fontFamily: fonts.bodyBold }]}>{fmt(points)} pts</Text>
        </View>
      </View>
    </View>
  )
}

function TierMark({ kind }: { kind: ReturnType<typeof userTier>["kind"] }) {
  if (kind === "sprout") {
    return (
      <View style={s.tierMark}>
        <LinearGradient colors={["#CFF8D8", "#67C887"]} style={s.sproutStem} />
        <LinearGradient colors={["#ECFFEB", "#8EE9B2"]} style={[s.sproutLeaf, s.sproutLeafLeft]} />
        <LinearGradient colors={["#EBFEFF", "#74D8B0"]} style={[s.sproutLeaf, s.sproutLeafRight]} />
        <View style={s.markGloss} />
      </View>
    )
  }

  if (kind === "flower") {
    const petals = [
      { left: 0, top: -16 },
      { left: 15, top: -5 },
      { left: 9, top: 14 },
      { left: -9, top: 14 },
      { left: -15, top: -5 },
    ]
    return (
      <View style={s.tierMark}>
        {petals.map((petal, index) => (
          <LinearGradient
            key={`${petal.left}-${petal.top}`}
            colors={index % 2 ? ["#F9FBFF", "#F199E3"] : ["#FFF4FE", "#D9E1FF"]}
            style={[s.flowerPetal, { transform: [{ translateX: petal.left }, { translateY: petal.top }, { rotate: `${index * 32}deg` }] }]}
          />
        ))}
        <LinearGradient colors={["#FFF6C7", "#F3CD64"]} style={s.flowerCenter} />
      </View>
    )
  }

  if (kind === "pomegranate") {
    return (
      <View style={s.tierMark}>
        <LinearGradient colors={["#FFF4FE", "#FF7070", "#D96AA7"]} style={s.pomegranateBody} />
        <LinearGradient colors={["#ECFFEB", "#9FEED3"]} style={s.pomegranateCrown} />
        <View style={s.pomegranateSeedA} />
        <View style={s.pomegranateSeedB} />
        <View style={s.markGloss} />
      </View>
    )
  }

  if (kind === "ruby") {
    return (
      <View style={s.tierMark}>
        <LinearGradient colors={["#FFF4FE", "#F199E3", "#9DCCFF"]} style={s.gemTop} />
        <LinearGradient colors={["#F199E3", "#A971FF"]} style={s.gemBody} />
        <View style={s.gemFacet} />
      </View>
    )
  }

  return (
    <View style={s.tierMark}>
      <LinearGradient colors={["#FFFFFF", "#BEEBFF", "#9DCCFF"]} style={s.diamondTop} />
      <LinearGradient colors={["#EBFEFF", "#9DCCFF", "#F9FBFF"]} style={s.diamondBody} />
      <View style={s.diamondFacet} />
    </View>
  )
}

function BalancePanel({
  total,
  available,
  today,
  onToday,
  onHistory,
  onShare,
}: {
  total: number
  available: number
  today: number
  onToday: () => void
  onHistory: () => void
  onShare: () => void
}) {
  return (
    <LinearGradient
      colors={["#EBFEFF", "rgba(255,244,254,0.72)", "#ECFFEB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.balancePanel}
    >
      <Pressable onPress={onShare} style={s.balanceShare}>
        <Text style={s.balanceIcon}>↗</Text>
      </Pressable>
      <View style={s.balanceGrid}>
        <BalanceTile value={fmt(total)} label="total points" />
        <BalanceTile value={fmt(available)} label="available" />
        <Pressable onPress={onToday} style={[s.balanceTile, s.balanceTileWide]}>
          <Text style={[s.balanceTileValue, { fontFamily: fonts.displayHeavy }]}>+{fmt(today)}</Text>
          <Text style={[s.balanceTileLabel, { fontFamily: fonts.bodyBold }]}>can get today</Text>
          <Text style={[s.balanceTileHint, { fontFamily: fonts.bodyBold }]}>open tasks</Text>
        </Pressable>
      </View>
      <Pressable onPress={onHistory} style={s.balanceHistory}>
        <Text style={s.balanceIcon}>◷</Text>
      </Pressable>
    </LinearGradient>
  )
}

function BalanceTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.balanceTile}>
      <Text style={[s.balanceTileValue, { fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={[s.balanceTileLabel, { fontFamily: fonts.bodyBold }]}>{label}</Text>
    </View>
  )
}

function SoftRgbSliders() {
  return (
    <View style={s.rgbSliders}>
      {[
        ["#A9B9FF", "#85F5F2", "#CDA9FF"],
        ["#F199E3", "#F1D09E", "#9FEED3"],
        ["#85F5F2", "#CDA9FF", "#9FEED3"],
      ].map((gradient, index) => (
        <View key={gradient.join("-")} style={s.rgbSliderShell}>
          <LinearGradient
            colors={gradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.rgbSliderFill}
          />
          <View style={[s.rgbSliderKnob, index === 0 ? s.rgbSliderKnobTop : index === 1 ? s.rgbSliderKnobMid : s.rgbSliderKnobLow]}>
            <Text style={s.rgbSliderKnobText}>+</Text>
          </View>
        </View>
      ))}
      <View style={s.softSparkle} />
      <View style={[s.softSparkle, s.softSparkleLow]} />
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    backgroundColor: "#F9FBFF",
    borderRadius: 34,
    padding: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  helloBlock: { flex: 1 },
  kicker: { fontSize: 11, letterSpacing: 1.8 },
  hello: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  citySwitch: { flexDirection: "row", gap: 7, marginTop: 6 },
  cityPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  cityPillActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.32, shadowRadius: 6, elevation: 2 },
  cityPillIdle: { backgroundColor: "rgba(225,230,239,0.68)" },
  cityPillText: { fontSize: 10 },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F9FBFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 8,
    elevation: 2,
  },
  circleButtonText: { color: "#91A1B4", fontSize: 25, lineHeight: 27 },

  dashboard: {
    borderRadius: 42,
    padding: 14,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#F9FBFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
  },
  dashboardGlowTop: {
    position: "absolute",
    top: -70,
    left: -34,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(235,254,255,0.54)",
  },
  dashboardGlowBottom: {
    position: "absolute",
    right: -76,
    bottom: 112,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(236,255,235,0.46)",
  },
  softOrb: { alignSelf: "center", width: 210, height: 210, borderRadius: 105, marginTop: 4, marginBottom: 18, alignItems: "center", justifyContent: "center" },
  softOrbGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 105, opacity: 0.74 },
  softOrbCore: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: "rgba(249,251,255,0.82)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
  },
  progressOrbWrap: { alignSelf: "center", width: 190, height: 190, borderRadius: 95, marginTop: 0, marginBottom: 12, alignItems: "center", justifyContent: "center" },
  progressOrbGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 95, opacity: 0.78 },
  progressOrb: {
    width: 142,
    height: 142,
    borderRadius: 71,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,251,255,0.82)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  progressOrbFill: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 71, opacity: 0.92 },
  progressOrbShine: { position: "absolute", top: 15, left: 18, width: 50, height: 30, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.38)" },
  tierBadge: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.52)", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  tierMark: { width: 48, height: 40, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  sproutStem: { position: "absolute", bottom: 7, width: 9, height: 28, borderRadius: 8, shadowColor: "#67C887", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 8 },
  sproutLeaf: { position: "absolute", width: 29, height: 20, borderRadius: 18, top: 10, shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.24, shadowRadius: 7 },
  sproutLeafLeft: { left: 6, transform: [{ rotate: "-28deg" }] },
  sproutLeafRight: { right: 5, transform: [{ rotate: "28deg" }] },
  markGloss: { position: "absolute", top: 9, left: 15, width: 18, height: 9, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.58)" },
  flowerPetal: { position: "absolute", left: 17, top: 16, width: 22, height: 28, borderRadius: 16, shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.2, shadowRadius: 7 },
  flowerCenter: { width: 20, height: 20, borderRadius: 10, shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  pomegranateBody: { width: 42, height: 40, borderRadius: 22, shadowColor: "#D96AA7", shadowOffset: { width: 4, height: 6 }, shadowOpacity: 0.28, shadowRadius: 9 },
  pomegranateCrown: { position: "absolute", top: 3, width: 24, height: 14, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  pomegranateSeedA: { position: "absolute", left: 20, top: 24, width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.62)" },
  pomegranateSeedB: { position: "absolute", right: 16, top: 29, width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.46)" },
  gemTop: { position: "absolute", top: 8, width: 39, height: 17, borderRadius: 7, transform: [{ rotate: "45deg" }], shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.22, shadowRadius: 8 },
  gemBody: { position: "absolute", top: 18, width: 36, height: 36, borderRadius: 8, transform: [{ rotate: "45deg" }], shadowColor: "#F199E3", shadowOffset: { width: 4, height: 6 }, shadowOpacity: 0.25, shadowRadius: 9 },
  gemFacet: { position: "absolute", top: 18, width: 18, height: 18, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.32)", transform: [{ rotate: "45deg" }] },
  diamondTop: { position: "absolute", top: 7, width: 42, height: 18, borderRadius: 8, transform: [{ rotate: "45deg" }], shadowColor: "#9DCCFF", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.26, shadowRadius: 9 },
  diamondBody: { position: "absolute", top: 18, width: 39, height: 39, borderRadius: 8, transform: [{ rotate: "45deg" }], shadowColor: "#9DCCFF", shadowOffset: { width: 5, height: 7 }, shadowOpacity: 0.3, shadowRadius: 10 },
  diamondFacet: { position: "absolute", top: 18, width: 18, height: 18, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.56)", transform: [{ rotate: "45deg" }] },
  tierName: { color: "#6E7D8E", fontSize: 14, lineHeight: 16, marginTop: 1, letterSpacing: 0 },
  tierPoints: { color: "#91A1B4", fontSize: 10, marginTop: 2 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  profileAvatar: { width: 58, height: 58, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  profileAvatarText: { color: "#91A1B4", fontSize: 24 },
  profileMain: { flex: 1 },
  profileName: { color: "#6E7D8E", fontSize: 24, lineHeight: 26, letterSpacing: 0 },
  profileStats: { flexDirection: "row", gap: 14, marginTop: 5 },
  profileStat: { color: "#91A1B4", fontSize: 11, fontWeight: "700" },
  profileIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F9FBFF", alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  profileIconText: { color: "#91A1B4", fontSize: 16, fontWeight: "900" },
  levelSplit: { flexDirection: "row", borderRadius: 24, overflow: "hidden", marginBottom: 12, backgroundColor: "#F9FBFF", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 3 },
  levelPaneLight: { flex: 1, minHeight: 82, backgroundColor: "#FFFFFF", padding: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  levelPaneBlue: { flex: 1, minHeight: 82, backgroundColor: "rgba(235,254,255,0.82)", padding: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  levelValueDark: { color: "#6E7D8E", fontSize: 50, lineHeight: 54, letterSpacing: 0 },
  levelValueLight: { color: "#7FAFC2", fontSize: 50, lineHeight: 54, letterSpacing: 0 },
  weekGain: { color: "#67C887", fontSize: 34, lineHeight: 37 },
  weekSpend: { color: "#91A1B4", fontSize: 34, lineHeight: 37 },
  levelLabelDark: { color: "#6E7D8E", fontSize: 11, lineHeight: 12 },
  levelLabelLight: { color: "#7FAFC2", fontSize: 11, lineHeight: 12 },
  dashboardSectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  dashboardSectionTitle: { color: "#6E7D8E", fontSize: 25, lineHeight: 28, letterSpacing: 0 },
  dashboardSectionLink: { color: "#91A1B4", fontSize: 11 },
  rgbPanel: {
    borderRadius: 40,
    padding: 18,
    minHeight: 210,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 4,
  },
  balancePanel: {
    borderRadius: 34,
    padding: 12,
    minHeight: 156,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 4,
  },
  balanceGrid: { flexDirection: "row", gap: 8, minHeight: 112, alignItems: "stretch", paddingTop: 22, paddingRight: 34 },
  balanceTile: {
    flex: 1,
    minHeight: 100,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 2,
  },
  balanceTileWide: { flex: 2, backgroundColor: "rgba(255,255,255,0.76)" },
  balanceTileValue: { color: "#6E7D8E", fontSize: 22, lineHeight: 25, letterSpacing: 0, textAlign: "center" },
  balanceTileLabel: { color: "#91A1B4", fontSize: 9, lineHeight: 11, marginTop: 5, textTransform: "uppercase", textAlign: "center" },
  balanceTileHint: { color: "#7FAFC2", fontSize: 10, marginTop: 8 },
  balanceShare: { position: "absolute", top: 11, right: 11, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  balanceHistory: { position: "absolute", right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.78)", alignItems: "center", justifyContent: "center" },
  balanceIcon: { color: "#91A1B4", fontSize: 18, fontWeight: "900" },
  rgbPanelHead: { flexDirection: "row", alignItems: "center", gap: 38, marginBottom: 12, paddingHorizontal: 18 },
  rgbTiny: { color: "#B0D4E3", fontSize: 13 },
  rgbLabel: { color: "#B0D4E3", fontSize: 13, marginLeft: "auto" },
  rgbSliders: { minHeight: 148, flexDirection: "row", gap: 28, alignItems: "center", paddingLeft: 28 },
  rgbSliderShell: {
    width: 22,
    height: 132,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 4,
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 3,
  },
  rgbSliderFill: { flex: 1, borderRadius: 10 },
  rgbSliderKnob: { position: "absolute", left: 1, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.44)", alignItems: "center", justifyContent: "center" },
  rgbSliderKnobTop: { top: 16 },
  rgbSliderKnobMid: { top: 64 },
  rgbSliderKnobLow: { bottom: 16 },
  rgbSliderKnobText: { color: "#8FB4C6", fontSize: 13, fontWeight: "800" },
  softSparkle: { position: "absolute", right: 20, top: 30, width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.82)", shadowColor: "#A3B1C6", shadowOffset: { width: 5, height: 5 }, shadowOpacity: 0.34, shadowRadius: 8, elevation: 2 },
  softSparkleLow: { right: 36, top: 94, width: 30, height: 30, opacity: 0.9 },
  rewardProgressCard: {
    borderRadius: 40,
    padding: 14,
    minHeight: 184,
    overflow: "hidden",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 4,
  },
  rewardProgressTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rewardProgressTitle: { color: "#6E7D8E", fontSize: 19, lineHeight: 22, letterSpacing: 0 },
  rewardProgressSub: { color: "#91A1B4", fontSize: 11, marginTop: 5, maxWidth: 190 },
  rewardProgressButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  rewardProgressButtonText: { color: "#91A1B4", fontSize: 18, fontWeight: "900" },
  rewardProgressLabel: { color: "#91A1B4", fontSize: 12, marginTop: 12 },
  levelBlocks: { flexDirection: "row", gap: 7, marginTop: 8 },
  levelBlock: { flex: 1, minHeight: 82, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.64)", padding: 7, justifyContent: "space-between", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 1 },
  levelBlockFuture: { backgroundColor: "rgba(225,230,239,0.42)" },
  levelCheck: { color: "#91A1B4", fontSize: 14, fontWeight: "900", minHeight: 18 },
  levelBlockText: { color: "#91A1B4", fontSize: 12, textAlign: "center" },
  blueRewardPill: { marginTop: 12, minHeight: 68, borderRadius: 28, backgroundColor: "#F9FBFF", padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.32, shadowRadius: 12, elevation: 3 },
  blueRewardText: { color: "#6E7D8E", fontSize: 20, letterSpacing: 0 },
  blueRewardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(235,254,255,0.82)", alignItems: "center", justifyContent: "center" },
  blueRewardIconText: { color: "#91A1B4", fontSize: 18, fontWeight: "900" },
  quickStatsPanel: { flexDirection: "row", gap: 0, marginBottom: 12, backgroundColor: "#F9FBFF", borderRadius: 28, overflow: "hidden", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 3 },
  quickStat: { flex: 1, minHeight: 82, justifyContent: "center", alignItems: "center" },
  quickStatValue: { color: "#6E7D8E", fontSize: 30, lineHeight: 32, letterSpacing: 0 },
  quickStatLabel: { color: "#91A1B4", fontSize: 9, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },

  metrics: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, borderRadius: 24, padding: 13, minHeight: 82, justifyContent: "center" },
  metricCardContent: { flex: 1, justifyContent: "center" },
  metricValue: { fontSize: 26, lineHeight: 28, letterSpacing: 0 },
  metricLabel: { fontSize: 9, marginTop: 5, letterSpacing: 0.8 },
  modeTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeTab: { flex: 1, borderRadius: 99, paddingVertical: 12, alignItems: "center", justifyContent: "center", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 2 },
  modeTabLight: { backgroundColor: "#FFFFFF" },
  modeTabBlue: { backgroundColor: "rgba(235,254,255,0.82)" },
  modeTabRed: { backgroundColor: "rgba(255,244,254,0.82)" },
  modeTabTextLight: { color: "#6E7D8E", fontSize: 12 },
  modeTabTextDark: { color: "#7FAFC2", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  actionPill: { flex: 1, borderRadius: 28, padding: 9, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden", minHeight: 60, shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 3 },
  actionPillDark: { backgroundColor: "#F9FBFF" },
  actionPillLight: { backgroundColor: "#F9FBFF" },
  actionIcon: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  actionIconDark: { backgroundColor: "rgba(235,254,255,0.88)" },
  actionIconLight: { backgroundColor: "rgba(255,244,254,0.88)" },
  actionIconText: { fontSize: 16, fontWeight: "900" },
  actionLabel: { fontSize: 13 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: "#6E7D8E", fontSize: 25, letterSpacing: 0 },
  sectionButton: { backgroundColor: "#F9FBFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  sectionButtonText: { color: "#91A1B4", fontSize: 11 },
  filterRail: { gap: 8, paddingBottom: 12 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: "rgba(249,251,255,0.52)" },
  filterChipText: { fontSize: 11 },
  offerRail: { gap: 12, paddingBottom: 20 },
  offerPressable: { width: 176 },
  offerCard: { minHeight: 174, borderRadius: 34, padding: 14, overflow: "hidden", shadowColor: "#A3B1C6", shadowOffset: { width: 8, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 3 },
  offerCardFeatured: { backgroundColor: "rgba(255,244,254,0.92)" },
  offerCardBlue: { backgroundColor: "rgba(235,254,255,0.92)" },
  offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  offerLogo: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  offerLogoDark: { backgroundColor: "rgba(255,255,255,0.72)" },
  offerLogoLight: { backgroundColor: "rgba(255,255,255,0.72)" },
  offerLogoText: { fontSize: 17, fontWeight: "900" },
  offerPoints: { backgroundColor: "rgba(255,255,255,0.60)", color: "#6E7D8E", borderRadius: 99, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  offerTitle: { fontSize: 21, lineHeight: 23, letterSpacing: 0, minHeight: 48 },
  offerVenue: { fontSize: 12, marginTop: 8 },
  offerLink: { marginTop: "auto", alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.58)" },
  offerLinkLight: { backgroundColor: "rgba(255,255,255,0.72)" },
  offerLinkDark: { backgroundColor: "rgba(255,255,255,0.14)" },
  offerLinkText: { fontSize: 12 },

  venueList: { gap: 12 },
  emptyVenues: { backgroundColor: "#F9FBFF", borderRadius: 28, padding: 16, alignItems: "center" },
  emptyVenuesText: { color: "#91A1B4", fontSize: 12 },
  venueSkeleton: { backgroundColor: "#F9FBFF", borderRadius: 28, padding: 12, flexDirection: "row", gap: 12 },
  skeletonLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(225,230,239,0.72)" },
  skeletonMain: { flex: 1, justifyContent: "center", gap: 8 },
  skeletonLineWide: { height: 14, borderRadius: 7, backgroundColor: "rgba(225,230,239,0.72)", width: "72%" },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: "rgba(225,230,239,0.48)", width: "54%" },
  skeletonChips: { flexDirection: "row", gap: 6 },
  skeletonChip: { width: 72, height: 24, borderRadius: 12, backgroundColor: "rgba(225,230,239,0.64)" },
  venueCard: { backgroundColor: "#F9FBFF", borderRadius: 28, padding: 12, flexDirection: "row", gap: 12, overflow: "hidden", shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 2 },
  venueLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(235,254,255,0.84)", alignItems: "center", justifyContent: "center" },
  venueLogoText: { color: "#7FAFC2", fontSize: 22 },
  venueMain: { flex: 1 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  venueName: { color: "#6E7D8E", fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8, letterSpacing: 0 },
  venueArrow: { color: "#91A1B4", fontSize: 22 },
  venueMeta: { color: "#91A1B4", fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  venueAddress: { color: "#A3B1C6", fontSize: 12, marginTop: 2 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  venueChipDark: { backgroundColor: "rgba(255,244,254,0.92)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipDarkText: { color: "#7A8EA3", fontSize: 10 },
  venueChipLight: { backgroundColor: "rgba(225,230,239,0.58)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipLightText: { color: "#91A1B4", fontSize: 10 },
  venueChipMint: { backgroundColor: "rgba(236,255,235,0.82)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipMintText: { color: "#7A8EA3", fontSize: 10 },
  specialLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "rgba(236,255,235,0.62)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  specialDot: { color: "#9FEED3", fontSize: 10 },
  specialText: { color: "#7FAFC2", fontSize: 12, flex: 1 },
})
