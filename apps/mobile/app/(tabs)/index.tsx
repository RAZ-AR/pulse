import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { i18n, setLocale } from "../../src/lib/i18n"
import { currentPet, nextPet } from "@pulse/shared"
import type { SupportedLocale } from "@pulse/shared"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, space, typeScale, useTheme } from "../../src/lib/theme"
import { LavaLampSurface } from "../../src/components/neu"
import { ComicBubble, REACTION_WORDS } from "../../src/components/ComicBubble"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

type RewardItem = {
  id: string
  title: string
  pointsCost: number
  venue: { id: string; name: string }
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

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#6366F1", "#0EA5E9"]

function getAvatarColor(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith("color:")) return null
  const idx = parseInt(avatarUrl.slice(6), 10)
  return AVATAR_COLORS[idx] ?? null
}

function userTier(points: number) {
  if (points <= 1000) return { name: "Росток", kind: "sprout", next: 1000, start: 0, colors: ["#ECFFEB", "#015634", "#FFFFFF"] as const }
  if (points <= 3000) return { name: "Цветок", kind: "flower", next: 3000, start: 1001, colors: ["#FFF4FE", "#F199E3", "#FFFFFF"] as const }
  if (points <= 5000) return { name: "Гранат", kind: "pomegranate", next: 5000, start: 3001, colors: ["#FFF4FE", "#FF8B8B", "#FFFFFF"] as const }
  if (points <= 7000) return { name: "Рубин", kind: "ruby", next: 7000, start: 5001, colors: ["#FFFFFF", "#F199E3", "#9DCCFF"] as const }
  return { name: "Бриллиант", kind: "diamond", next: 10000, start: 7001, colors: ["#EBFEFF", "#9DCCFF", "#FFFFFF"] as const }
}

function tierProgress(points: number, start: number, next: number) {
  return Math.max(0.08, Math.min(1, (points - start) / Math.max(1, next - start)))
}

// Cute words the pet flashes on its LCD, per interface language.
const PET_MOODS: Record<string, string[]> = {
  en: ["HI", "LOVE", "<3", "YUM", "PLAY", "HUG"],
  ru: ["ПРИВЕТ", "ЛЮБЛЮ", "<3", "ВКУСНО", "ИГРАЙ", "ОБНИМИ"],
  sr: ["ZDRAVO", "VOLIM", "<3", "MLJAC", "IGRA", "ZAGRLI"],
}

// Brushed-aluminum body tints — the COLOR key shuffles between these.
const BODY_COLORS: readonly (readonly [string, string])[] = [
  ["#DBDBD6", "#BCBCB6"], // silver
  ["#B6D2EC", "#88AAD0"], // steel blue
  ["#AEE0C0", "#82C39C"], // sage
  ["#EDD7A4", "#D4B772"], // sand
  ["#D2BFEE", "#AC92D6"], // lilac
  ["#F0C3CC", "#D8929E"], // rose
  ["#AEE6DA", "#82C8B6"], // mint
  ["#F2C9A6", "#DCA876"], // peach
]

export default function HomeScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t, i18n } = useTranslation(["common", "venue"])
  const petWords = PET_MOODS[(i18n.language ?? "en").slice(0, 2)] ?? PET_MOODS.en

  const [activeFilterKey, setActiveFilterKey] = useState("all")
  const [petTapNonce, setPetTapNonce] = useState(0)
  const me = trpc.user.me.useQuery()
  const utils = trpc.useUtils()
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const rewards = trpc.reward.list.useQuery({ limit: 8 })
  const selectedCity = resolveCity(me.data?.homeCity)
  const partnerOffers = trpc.offer.list.useQuery({ city: selectedCity.name, limit: 6 })
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
  const petKey = currentPet(lifetimePoints, true)?.key ?? "HATCHLING"
  // Ring fills toward the next pet's ABSOLUTE threshold, counting all-time
  // points from zero (e.g. 500 of 1500 = 33%). Full + current pet at max.
  const nextLevel = nextPet(lifetimePoints)
  const nextPetKey = nextLevel?.key ?? null
  const petRingProgress = nextLevel ? Math.min(1, lifetimePoints / nextLevel.threshold) : 1
  const streak = me.data?.currentStreak ?? 0
  const weeklyEarned = me.data?.weeklyEarnedPoints ?? 15
  const weeklySpent = me.data?.weeklySpentPoints ?? 10
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

  // Progress bar eases toward its target fill instead of snapping to it.
  const progressAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [progress, progressAnim])
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: theme.bg }]}
      contentContainerStyle={s.content}
      scrollEventThrottle={16}
      removeClippedSubviews
    >
      <View style={s.topBar}>
        <Pressable onPress={() => router.push("/(tabs)/profile")} hitSlop={8}>
          {getAvatarColor(me.data?.avatarUrl) ? (
            <View style={[s.profileAvatar, { backgroundColor: getAvatarColor(me.data?.avatarUrl)! }]}>
              <Text style={[s.profileAvatarText, { fontFamily: fonts.displayHeavy, color: "#FFFFFF" }]}>
                {initials(me.data?.name)}
              </Text>
            </View>
          ) : (
            <LavaLampSurface style={s.profileAvatar}>
              <Text style={[s.profileAvatarText, { fontFamily: fonts.displayHeavy }]}>
                {initials(me.data?.name)}
              </Text>
            </LavaLampSurface>
          )}
        </Pressable>
        <View style={s.helloBlock}>
          <Text style={[s.hello, { color: theme.text, fontFamily: fonts.serif }]}>
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
                  <Text style={[s.cityPillText, { color: active ? "#75736A" : theme.textMuted, fontFamily: fonts.bodyBold }]}>
                    ⌖ {city.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <LanguageSwitcher />
        </View>
      </View>

      <View style={s.petStage}>
        <View style={s.petHeading}>
          <Text style={[s.petKicker, { fontFamily: fonts.pixel }]}>PET STATUS / {petKey}</Text>
          <Pressable onPress={() => router.push("/pet" as Parameters<typeof router.push>[0])}>
            <Text style={[s.petOpen, { fontFamily: fonts.pixel }]}>OPEN ↗</Text>
          </Pressable>
        </View>
        <View style={s.petSpriteWrap}>
          <DotMatrixPet onPress={() => setPetTapNonce((n) => n + 1)} />
          <ComicBubble
            text={REACTION_WORDS[Math.max(0, petTapNonce - 1) % REACTION_WORDS.length]!}
            trigger={petTapNonce}
            tint="#111111"
            style={s.petBubble}
          />
        </View>
        <View style={s.petStats}>
          <PetStat label="POINTS" value={total.toLocaleString()} />
          <PetStat label="STREAK" value={`${streak}D`} />
          <PetStat label="LEVEL" value={`${Math.round(progress * 100)}%`} />
        </View>
        <View style={s.petProgress}><Animated.View style={[s.petProgressFill, { width: progressWidth }]} /></View>
      </View>

      <View style={s.actionCards}>
        <Pressable onPress={() => router.push("/rewards")} style={[s.actionCard, s.offerActionCard]}>
          <Text style={[s.actionLabel, { fontFamily: fonts.pixel }]}>SPECIAL OFFERS</Text>
          <Text style={[s.actionValue, { fontFamily: fonts.displayHeavy }]}>VIEW</Text>
          <Text style={[s.actionMeta, { fontFamily: fonts.pixel }]}>DISCOUNTS / REWARDS ↗</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/gift")} style={[s.actionCard, s.sendActionCard]}>
          <Text style={[s.actionLabel, { fontFamily: fonts.pixel }]}>SEND POINTS</Text>
          <Text style={[s.actionValue, { fontFamily: fonts.displayHeavy }]}>GIFT</Text>
          <Text style={[s.actionMeta, { fontFamily: fonts.pixel }]}>MESSAGE / QR / SHARE ↗</Text>
        </Pressable>
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

      {(partnerOffers.data?.offers ?? []).length > 0 ? (
        <>
          <SectionHeader title={t("partnerBonuses", "Partner Bonuses")} action={t("seeAll", "See all")} onPress={() => router.push("/map")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.offerRail}>
            {(partnerOffers.data?.offers ?? []).map((offer) => {
              const tinted = !!offer.cardColor
              const titleColor = tinted ? "#FFFFFF" : "#2C3E50"
              const subColor   = tinted ? "rgba(255,255,255,0.85)" : "#75736A"
              return (
              <Pressable
                key={offer.id}
                onPress={() => router.push({ pathname: "/venue/[id]", params: { id: offer.venue.id } })}
                style={[s.partnerOfferCard, tinted && { backgroundColor: offer.cardColor ?? undefined, borderTopColor: "rgba(255,255,255,0.35)", borderBottomColor: "rgba(0,0,0,0.18)" }]}
              >
                <View style={[s.partnerOfferPtsBox, tinted && { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.35)" }]}>
                  <Text style={[s.partnerOfferPts, { fontFamily: fonts.robotoBlack, fontWeight: "900", color: tinted ? "#FFFFFF" : "#75736A" }]}>+{offer.pointsReward}</Text>
                  <Text style={[s.partnerOfferPtsLabel, { fontFamily: fonts.robotoMedium, fontWeight: "500", color: tinted ? "#FFFFFF" : "#75736A" }]}>pts</Text>
                </View>
                <Text style={[s.partnerOfferTitle, { color: titleColor, fontFamily: fonts.robotoBold, fontWeight: "700" }]} numberOfLines={2}>
                  {offer.title}
                </Text>
                {offer.description ? (
                  <Text style={[s.partnerOfferVenue, { color: subColor, fontFamily: fonts.roboto, fontWeight: "400" }]} numberOfLines={1}>
                    {offer.description}
                  </Text>
                ) : null}
                <Text style={[s.partnerOfferVenue, { color: subColor, fontFamily: fonts.roboto, fontWeight: "400" }]} numberOfLines={1}>
                  {offer.venue.name}
                </Text>
                {offer.pointsExpireDays ? (
                  <Text style={[s.partnerOfferPtsLabel, { color: subColor, fontFamily: fonts.roboto, fontWeight: "400" }]} numberOfLines={1}>
                    ⏳ сгорают через {offer.pointsExpireDays} дн.
                  </Text>
                ) : null}
              </Pressable>
              )
            })}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader title={t("venuesNearby")} action={t("nav.map")} onPress={() => router.push("/map")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
        {VENUE_FILTERS.map((filter) => {
          const isActive = filter.key === activeFilterKey
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilterKey(filter.key)}
              style={[s.filterChip, isActive ? s.filterChipActive : s.filterChipIdle]}
            >
              <Text style={[s.filterChipText, { color: isActive ? "#75736A" : colors.ink, fontFamily: fonts.robotoMedium, fontWeight: "500" }]}>
                {filter.label}
              </Text>
            </Pressable>
          )
        })}
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
            <Text style={[s.emptyVenuesText, { fontFamily: fonts.robotoMedium, fontWeight: "500" }]}>
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

      <View style={s.controlDock}>
        <CircleControl glyph="⌖" label="PLACES" onPress={() => router.push("/map")} />
        <Pressable onPress={() => router.push("/scan")} style={s.scanControl}>
          <Text style={s.scanGlyph}>♥</Text>
          <Text style={[s.scanLabel, { fontFamily: fonts.pixel }]}>SCAN</Text>
        </Pressable>
        <CircleControl glyph="◎" label="PROFILE" onPress={() => router.push("/(tabs)/profile")} />
      </View>
    </ScrollView>
  )
}

const LANGS: { code: SupportedLocale; label: string }[] = [
  { code: "sr", label: "SR" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
]

function LanguageSwitcher() {
  const [, forceUpdate] = useState(0)
  const current = i18n.language as SupportedLocale

  function pick(code: SupportedLocale) {
    if (code === current) return
    setLocale(code).catch(() => {})
    forceUpdate((n) => n + 1)
  }

  return (
    <View style={s.langSwitch}>
      {LANGS.map(({ code, label }) => {
        const active = current === code
        return (
          <Pressable
            key={code}
            onPress={() => pick(code)}
            style={[s.langPill, active ? s.langPillActive : s.langPillIdle]}
          >
            <Text
              style={[
                s.langPillText,
                { fontFamily: fonts.bodyBold, color: active ? "#5A7A99" : "#A0B0C0" },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const DOT_PET_ROWS = [
  "      ●●●     ",
  "    ●●●●●●●   ",
  "   ●● ●● ●●   ",
  "   ●●●●●●●●   ",
  "    ●●●●●●    ",
  "  ●●●●●●●●●●  ",
  " ●●●  ●●  ●●● ",
  " ●●●●●●●●●●●  ",
  "    ●●  ●●    ",
]

// Idle "breathing" loop + a bounce-and-react tap, so the pet reads as alive
// even while its dot-matrix frame itself stays fixed.
function DotMatrixPet({ onPress }: { onPress?: () => void }) {
  const breathe = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.035, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [breathe])

  const tapScale = useRef(new Animated.Value(1)).current
  function handleTap() {
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 1.16, duration: 90, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start()
    onPress?.()
  }

  return (
    <Pressable onPress={handleTap}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(breathe, tapScale) }] }}>
        <View style={s.dotPet}>{DOT_PET_ROWS.map((row, index) => <Text key={index} style={s.dotPetRow}>{row}</Text>)}</View>
      </Animated.View>
    </Pressable>
  )
}

function PetStat({ label, value }: { label: string; value: string }) {
  return <View style={s.petStat}><Text style={s.petStatLabel}>{label}</Text><Text style={s.petStatValue}>{value}</Text></View>
}

function CircleControl({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.circleControl}><Text style={s.circleGlyph}>{glyph}</Text><Text style={[s.circleLabel, { fontFamily: fonts.pixel }]}>{label}</Text></Pressable>
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.sectionTitleRow}>
        <Text style={[s.sectionMark, { fontFamily: fonts.pixel }]}>▸</Text>
        <Text style={[s.sectionTitle, { fontFamily: fonts.serif, color: "#015634" }]}>{title}</Text>
      </View>
      <Pressable onPress={onPress} style={s.sectionButton}>
        <Text style={[s.sectionButtonText, { fontFamily: fonts.pixel, fontSize: 8, color: "#75736A" }]}>{action}</Text>
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
      <View style={[s.offerCard, featured && s.offerCardFeatured]}>
        <View style={s.offerTop}>
          <View style={s.offerLogo}>
            <Text style={[s.offerLogoText, { color: "#8C887E" }]}>✦</Text>
          </View>
          <Text style={[s.offerPoints, { fontFamily: fonts.robotoBlack, fontWeight: "900" }]}>
            {points} {pointsLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={[s.offerTitle, { color: "#015634", fontFamily: fonts.robotoBold, fontWeight: "700" }]} numberOfLines={2}>{title}</Text>
        <Text style={[s.offerVenue, { color: "#8C887E", fontFamily: fonts.robotoMedium, fontWeight: "500" }]} numberOfLines={1}>{venue}</Text>
        <View style={s.offerLink}>
          <Text style={[s.offerLinkText, { color: "#75736A", fontFamily: fonts.robotoBold, fontWeight: "700" }]}>{openLabel.toUpperCase()} ↗</Text>
        </View>
      </View>
    </Pressable>
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
        <Text style={[s.venueLogoText, { fontFamily: fonts.robotoBold, fontWeight: "700" }]}>{logo}</Text>
      </View>
      <View style={s.venueMain}>
        <View style={s.venueTitleRow}>
          <Text style={[s.venueName, { fontFamily: fonts.robotoBold, fontWeight: "700" }]} numberOfLines={1}>{name}</Text>
          <Text style={s.venueArrow}>↗</Text>
        </View>
        <Text style={[s.venueMeta, { fontFamily: fonts.robotoMedium, fontWeight: "500", textTransform: "uppercase" }]} numberOfLines={1}>
          {category} · {city}
        </Text>
        <Text style={[s.venueAddress, { fontFamily: fonts.roboto, fontWeight: "400" }]} numberOfLines={1}>{address}</Text>
        <View style={s.venueChips}>
          <View style={s.venueChipDark}>
            <Text style={[s.venueChipDarkText, { fontFamily: fonts.robotoBold, fontWeight: "700" }]}>
              {rate ? `${rate.toFixed(3)} pts/RSD` : receiptScanLabel}
            </Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.robotoMedium, fontWeight: "500" }]}>{distanceLabel(distance)}</Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.robotoMedium, fontWeight: "500" }]}>{ratingLabel(rating, reviews)}</Text>
          </View>
          {discount ? (
            <View style={s.venueChipMint}>
              <Text style={[s.venueChipMintText, { fontFamily: fonts.robotoBold, fontWeight: "700" }]}>-{discount}%</Text>
            </View>
          ) : null}
        </View>
        <View style={s.specialLine}>
          <Text style={s.specialDot}>●</Text>
          <Text style={[s.specialText, { fontFamily: fonts.robotoMedium, fontWeight: "500" }]} numberOfLines={1}>{offer}</Text>
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
  content: { padding: space.screen, paddingBottom: space.bottomGutter },
  petStage: { backgroundColor: "#B9B6B3", padding: 16, marginBottom: 24, borderRadius: 8 },
  petHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  petKicker: { color: "#111111", fontSize: 8, letterSpacing: 1 },
  petOpen: { color: "#111111", fontSize: 8, letterSpacing: 1 },
  petSpriteWrap: { position: "relative" },
  petBubble: { top: 10, right: 16 },
  dotPet: { alignItems: "center", justifyContent: "center", minHeight: 210, paddingVertical: 18 },
  dotPetRow: { color: "#111111", fontSize: 18, lineHeight: 19, letterSpacing: 3 },
  petStats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(17,17,17,0.2)", paddingTop: 12, gap: 20 },
  petStat: { flex: 1 },
  petStatLabel: { color: "#5D5B58", fontFamily: "monospace", fontSize: 8, letterSpacing: 1 },
  petStatValue: { color: "#111111", fontFamily: fonts.displayHeavy, fontSize: 22, marginTop: 4 },
  petProgress: { height: 4, backgroundColor: "rgba(17,17,17,0.18)", marginTop: 14 },
  petProgressFill: { height: 4, backgroundColor: "#111111" },
  actionCards: { flexDirection: "row", gap: 10, marginBottom: 26 },
  actionCard: { flex: 1, minHeight: 168, borderRadius: 8, padding: 14, justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(17,17,17,0.18)" },
  offerActionCard: { backgroundColor: colors.orange },
  sendActionCard: { backgroundColor: "#D8D6D0" },
  actionLabel: { color: "#111111", fontSize: 8, letterSpacing: 0.8 },
  actionValue: { color: "#111111", fontSize: 30, lineHeight: 32 },
  actionMeta: { color: "rgba(17,17,17,0.68)", fontSize: 7, letterSpacing: 0.5 },
  controlDock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 8 },
  circleControl: { alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 36, backgroundColor: "#E4E1DC" },
  circleGlyph: { color: "#111111", fontSize: 28, lineHeight: 30 },
  circleLabel: { color: "#111111", fontSize: 7, letterSpacing: 0.8, marginTop: 2 },
  scanControl: { alignItems: "center", justifyContent: "center", width: 90, height: 90, borderRadius: 45, backgroundColor: "#111111" },
  scanGlyph: { color: "#F04432", fontSize: 29, lineHeight: 32 },
  scanLabel: { color: "#F1F0EC", fontSize: 8, letterSpacing: 1, marginTop: 3 },
  // enlarged device bottom — beta signature in pixel font
  deviceFooter: { alignItems: "center", paddingTop: 10, paddingBottom: 16, marginTop: 2 },
  deviceFooterText: { fontSize: 9, letterSpacing: 1.5, color: "#8A887F" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 6,
    paddingTop: 2,
  },
  helloBlock: { flex: 1 },
  hello: { fontSize: typeScale.display.size, lineHeight: typeScale.display.line, letterSpacing: 0 },
  citySwitch: { flexDirection: "row", gap: 7, marginTop: 6 },
  cityPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  cityPillActive: { backgroundColor: "#FFFFFF", shadowColor: "#C9C4B4", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.32, shadowRadius: 6, elevation: 2 },
  cityPillIdle: { backgroundColor: "rgba(225,230,239,0.68)" },
  cityPillText: { fontSize: 10 },

  profileAvatar: { width: 58, height: 58, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: "#C9C4B4", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  profileAvatarText: { color: "#75736A", fontSize: 24 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionMark: { fontSize: 9, color: colors.orange },
  sectionTitle: { color: colors.ink, fontSize: typeScale.title.size, lineHeight: typeScale.title.line, letterSpacing: 0 },
  sectionButton: { backgroundColor: colors.paper, borderRadius: 4, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: "#D8D6CF" },
  sectionButtonText: { color: "#75736A", fontSize: 11 },

  langSwitch: { flexDirection: "row", gap: 4, marginTop: 6 },
  langPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  langPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#C9C4B4",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 2,
  },
  langPillIdle: { backgroundColor: "rgba(225,230,239,0.55)" },
  langPillText: { fontSize: 10, letterSpacing: 0.8 },

  filterRail: { gap: 8, paddingBottom: 12 },
  filterChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  filterChipActive: { backgroundColor: "#efeeea", borderColor: "rgba(110,102,86,0.18)", borderBottomWidth: 3, borderBottomColor: "rgba(242,166,110,0.55)", shadowColor: "#9A958A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  filterChipIdle: { backgroundColor: "#efeeea", borderColor: "rgba(110,102,86,0.10)" },
  filterChipText: { fontSize: 11 },
  offerRail: { gap: 12, paddingBottom: 20 },

  partnerOfferCard: { width: 148, minHeight: 168, backgroundColor: colors.orange, borderRadius: 8, padding: 14, gap: 6, borderWidth: 1, borderColor: "rgba(17,17,17,0.16)" },
  partnerOfferPtsBox: { backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(17,17,17,0.12)", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "baseline", gap: 2 },
  partnerOfferPts: { fontSize: 18, lineHeight: 20 },
  partnerOfferPtsLabel: { fontSize: 10 },
  partnerOfferTitle: { fontSize: 13, lineHeight: 17 },
  partnerOfferVenue: { fontSize: 11 },
  offerPressable: { width: 176 },
  offerCard: { minHeight: 150, borderRadius: 8, padding: 14, overflow: "hidden", backgroundColor: colors.paper, borderWidth: 1, borderColor: "#D8D6CF", shadowColor: "#111111", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 0, elevation: 1 },
  offerCardFeatured: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  offerLogo: { width: 38, height: 38, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#E5E3DE", borderWidth: 1, borderColor: "#D8D6CF" },
  offerLogoText: { fontSize: 16, fontWeight: "900" },
  offerPoints: { backgroundColor: "#DBDBD7", color: "#015634", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#C4C4BE", paddingHorizontal: 9, paddingVertical: 7, fontSize: 8, letterSpacing: 0.5 },
  offerTitle: { fontSize: typeScale.card.size, lineHeight: typeScale.card.line, letterSpacing: 0, minHeight: 40 },
  offerVenue: { fontSize: 12, marginTop: 8 },
  offerLink: { marginTop: "auto", alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#E5E3DE", borderWidth: 1, borderColor: "#D8D6CF" },
  offerLinkText: { fontSize: 8, letterSpacing: 0.5 },

  venueList: { gap: 12 },
  emptyVenues: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 16, alignItems: "center" },
  emptyVenuesText: { color: "#75736A", fontSize: 12 },
  venueSkeleton: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 12, flexDirection: "row", gap: 12 },
  skeletonLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(225,230,239,0.72)" },
  skeletonMain: { flex: 1, justifyContent: "center", gap: 8 },
  skeletonLineWide: { height: 14, borderRadius: 7, backgroundColor: "rgba(225,230,239,0.72)", width: "72%" },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: "rgba(225,230,239,0.48)", width: "54%" },
  skeletonChips: { flexDirection: "row", gap: 6 },
  skeletonChip: { width: 72, height: 24, borderRadius: 12, backgroundColor: "rgba(225,230,239,0.64)" },
  venueCard: { backgroundColor: "#efeeea", borderRadius: 20, padding: 12, flexDirection: "row", gap: 12, overflow: "hidden", borderTopWidth: 1.5, borderTopColor: "rgba(255,255,255,0.95)", borderBottomWidth: 4, borderBottomColor: "rgba(110,102,86,0.16)", shadowColor: "#9A958A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 3 },
  venueLogo: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", alignItems: "center", justifyContent: "center" },
  venueLogoText: { color: "#75736A", fontSize: 22 },
  venueMain: { flex: 1 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  venueName: { color: "#015634", fontSize: typeScale.card.size, lineHeight: typeScale.card.line, flex: 1, marginRight: 8, letterSpacing: 0 },
  venueArrow: { color: "#75736A", fontSize: 22 },
  venueMeta: { color: "#8C887E", fontSize: 8, marginTop: 4, letterSpacing: 0.4 },
  venueAddress: { color: "#C9C4B4", fontSize: 12, marginTop: 2 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  venueChipDark: { backgroundColor: "#DBDBD7", borderRadius: 7, borderWidth: 1, borderColor: "#C4C4BE", paddingHorizontal: 8, paddingVertical: 6 },
  venueChipDarkText: { color: "#015634", fontSize: 7, letterSpacing: 0.3 },
  venueChipLight: { backgroundColor: "#efeeea", borderRadius: 7, borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", paddingHorizontal: 8, paddingVertical: 6 },
  venueChipLightText: { color: "#75736A", fontSize: 7, letterSpacing: 0.3 },
  venueChipMint: { backgroundColor: "#DCEFE6", borderRadius: 7, borderWidth: 1, borderColor: "rgba(95,174,146,0.4)", paddingHorizontal: 8, paddingVertical: 6 },
  venueChipMintText: { color: "#013d24", fontSize: 7, letterSpacing: 0.3 },
  specialLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "rgba(236,255,235,0.62)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  specialDot: { color: "#015634", fontSize: 10 },
  specialText: { color: "#75736A", fontSize: 12, flex: 1 },
})
