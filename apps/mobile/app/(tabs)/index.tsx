import { useEffect, useRef, useState } from "react"
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import QRCode from "react-native-qrcode-svg"
import { TamagotchiWindow } from "../../src/components/Tamagotchi"
import { DeviceChrome, LcdScreen, ModuleGrid, ScreenToggle } from "../../src/components/console"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { i18n, setLocale } from "../../src/lib/i18n"
import { currentPet } from "@pulse/shared"
import type { SupportedLocale } from "@pulse/shared"
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
  const [deviceMode, setDeviceMode] = useState<"home" | "earn" | "spend">("home")
  // Screen theme — dark glass (default) or the original light LCD.
  const [screenDark, setScreenDark] = useState(true)
  // Body tint — the COLOR key shuffles it.
  const [bodyColor, setBodyColor] = useState<readonly [string, string]>(BODY_COLORS[0]!)
  // LCD switch animation — content fades/scales in while a scanline sweeps down.
  const lcdAnim = useRef(new Animated.Value(1)).current
  const scanAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    lcdAnim.setValue(0)
    scanAnim.setValue(0)
    Animated.parallel([
      Animated.timing(lcdAnim, { toValue: 1, duration: 240, useNativeDriver: false }),
      Animated.timing(scanAnim, { toValue: 1, duration: 360, useNativeDriver: false }),
    ]).start()
  }, [deviceMode, lcdAnim, scanAnim])
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
  const streak = me.data?.currentStreak ?? 0
  const weeklyEarned = me.data?.weeklyEarnedPoints ?? 15
  const weeklySpent = me.data?.weeklySpentPoints ?? 10
  const activeChallengeRewards = activeChallenges.reduce((sum, uc) => sum + uc.challenge.pointsReward, 0)
  const todayAvailable = (me.data?.todayPotentialPoints ?? 0) + activeChallengeRewards
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

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

      <DeviceChrome colors={bodyColor} right={<ScreenToggle dark={screenDark} onToggle={() => setScreenDark((v) => !v)} />}>
        <Animated.View
          style={[
            deviceMode !== "home" && s.lcdAnimWrap,
            { opacity: lcdAnim, transform: [{ scale: lcdAnim.interpolate({ inputRange: [0, 1], outputRange: [0.975, 1] }) }] },
          ]}
        >
          {deviceMode === "home" ? (
            <TamagotchiWindow
              petKey={petKey}
              streak={streak}
              petName={me.data?.petName}
              coins={total}
              lifetimePoints={lifetimePoints}
              ringProgress={progress}
              weeklyEarned={weeklyEarned}
              weeklySpent={weeklySpent}
              words={petWords}
              earnedLabel={t("earnedThisWeek")}
              spentLabel={t("spentThisWeek")}
              dark={screenDark}
              info={[
                { label: "STREAK",  value: `${streak}d` },
                { label: "WELCOME", value: `${welcomeDays}d` },
                { label: "QUESTS",  value: `${activeChallenges.length}` },
              ]}
              onOpen={() => router.push("/pet" as Parameters<typeof router.push>[0])}
            />
          ) : deviceMode === "earn" ? (
            <EarnPanel total={total} weekly={weeklyEarned} today={todayAvailable} dark={screenDark} />
          ) : (
            <SpendPanel rewards={rewardItems} available={total} dark={screenDark} />
          )}
          {/* scanline sweep on mode switch (earn/spend only) */}
          {deviceMode !== "home" ? (
            <Animated.View
              pointerEvents="none"
              style={[
                s.scanline,
                {
                  opacity: scanAnim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.7, 0.7, 0] }),
                  transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) }],
                },
              ]}
            />
          ) : null}
        </Animated.View>

        {/* Reference control grid — fixed hardware modules, like a lock-screen device */}
        <ModuleGrid
          map={{ glyph: "⌖", label: "MAP", onPress: () => router.push("/map") }}
          check={{ glyph: "✓", label: "CHECK", onPress: () => router.push("/checkin") }}
          color={{ swatches: BODY_COLORS, onPick: setBodyColor }}
          reward={{ glyph: "▶", label: "REWARD", onPress: () => router.push("/rewards") }}
          scan={{ glyph: "+", label: "SCAN", onPress: () => router.push("/scan") }}
          earn={{ glyph: "→", label: "SEND", color: "#E23B22", onPress: () => router.push("/gift") }}
          matrixTint={bodyColor[1]}
          onStatus={() => router.push("/pet" as Parameters<typeof router.push>[0])}
        />

        <View style={s.deviceFooter}>
          <Text style={[s.deviceFooterText, { fontFamily: fonts.pixel }]}>--- ayoo! --- beta 1 ---</Text>
        </View>

        {deviceMode !== "home" ? (
          <Pressable onPress={() => setDeviceMode("home")} style={({ pressed }) => [s.backBar, !screenDark && s.backBarLight, pressed && s.backBarPressed]}>
            <Text style={[s.backBarText, !screenDark && s.backBarTextLight, { fontFamily: fonts.pixel }]}>◀ BACK</Text>
          </Pressable>
        ) : null}
      </DeviceChrome>

      <View style={s.afterDevice} />

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
            {(partnerOffers.data?.offers ?? []).map((offer) => (
              <Pressable
                key={offer.id}
                onPress={() => router.push({ pathname: "/venue/[id]", params: { id: offer.venue.id } })}
                style={s.partnerOfferCard}
              >
                <View style={s.partnerOfferPtsBox}>
                  <Text style={[s.partnerOfferPts, { fontFamily: fonts.robotoBlack, fontWeight: "900", color: "#75736A" }]}>+{offer.pointsReward}</Text>
                  <Text style={[s.partnerOfferPtsLabel, { fontFamily: fonts.robotoMedium, fontWeight: "500", color: "#75736A" }]}>pts</Text>
                </View>
                <Text style={[s.partnerOfferTitle, { color: "#2C3E50", fontFamily: fonts.robotoBold, fontWeight: "700" }]} numberOfLines={2}>
                  {offer.title}
                </Text>
                <Text style={[s.partnerOfferVenue, { color: "#75736A", fontFamily: fonts.roboto, fontWeight: "400" }]} numberOfLines={1}>
                  {offer.venue.name}
                </Text>
              </Pressable>
            ))}
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
    </ScrollView>
  )
}

// Monochrome screen colours per theme (accents green/red stay coloured).
function screenInk(dark: boolean) {
  return { ink: dark ? "#CFE3C4" : "#3A3F47", dim: dark ? "#8A887F" : "#9AA0AB" }
}

// ── EARN mode panel — live earn stats on the device LCD ──
function EarnPanel({ total, weekly, today, dark }: { total: number; weekly: number; today: number; dark: boolean }) {
  const { ink, dim } = screenInk(dark)
  return (
    <LcdScreen accent="#4FA988" dark={dark}>
      <Text style={[s.modeTitle, { fontFamily: fonts.pixel, color: "#4FA988" }]}>EARN</Text>
      <Text style={[s.modeBig, { fontFamily: fonts.pixel, color: ink }]}>{total.toLocaleString()}</Text>
      <View style={s.modeStatsRow}>
        <View style={s.modeStat}>
          <Text style={[s.modeStatVal, { fontFamily: fonts.pixel, color: ink }]}>+{weekly.toLocaleString()}</Text>
          <Text style={[s.modeStatLab, { fontFamily: fonts.pixel, color: dim }]}>WEEK</Text>
        </View>
        <View style={s.modeStat}>
          <Text style={[s.modeStatVal, { fontFamily: fonts.pixel, color: ink }]}>+{today.toLocaleString()}</Text>
          <Text style={[s.modeStatLab, { fontFamily: fonts.pixel, color: dim }]}>TODAY</Text>
        </View>
      </View>
      <Text style={[s.modeHint, { fontFamily: fonts.pixel, color: dim }]}>SCAN ↓ A RECEIPT TO EARN</Text>
    </LcdScreen>
  )
}

// ── SPEND mode panel — pick a reward → redeem QR right on the LCD ──
function SpendPanel({ rewards, available, dark }: { rewards: RewardItem[]; available: number; dark: boolean }) {
  const utils = trpc.useUtils()
  const { ink, dim } = screenInk(dark)
  const rowBg = dark ? "#1A1B16" : "#efeeea"
  const rowBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(110,102,86,0.14)"
  const rowEdge = dark ? "rgba(0,0,0,0.45)" : "rgba(110,102,86,0.16)"
  const [redemption, setRedemption] = useState<{ code: string; title: string; expiresAt: Date } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const redeem = trpc.reward.redeem.useMutation({
    onSuccess: (data, vars) => {
      const r = rewards.find((x) => x.id === vars.rewardId)
      setRedemption({ code: data.redemptionCode, title: r?.title ?? "", expiresAt: new Date(data.expiresAt) })
      utils.user.me.invalidate()
      utils.reward.list.invalidate()
    },
    onError: (e) => setErr(e.message),
  })

  if (redemption) {
    return (
      <LcdScreen accent="#E23B22" dark={dark}>
        <Text style={[s.modeTitle, { fontFamily: fonts.pixel, color: "#E23B22" }]}>SHOW TO CASHIER</Text>
        <View style={s.qrBox}>
          <QRCode value={redemption.code} size={132} backgroundColor="#FFFFFF" color="#1F2937" />
        </View>
        <Text style={[s.qrCode, { fontFamily: fonts.pixel, color: dim }]} numberOfLines={1}>{redemption.code}</Text>
        <Countdown to={redemption.expiresAt} dim={dim} />
      </LcdScreen>
    )
  }

  return (
    <LcdScreen accent="#E23B22" dark={dark}>
      <Text style={[s.modeTitle, { fontFamily: fonts.pixel, color: "#E23B22" }]}>SPEND · {available.toLocaleString()}</Text>
      {err ? <Text style={[s.modeErr, { fontFamily: fonts.pixel }]} numberOfLines={2}>{err}</Text> : null}
      <ScrollView style={s.rewardScroll} contentContainerStyle={s.rewardScrollInner} showsVerticalScrollIndicator={false}>
        {rewards.length === 0 ? (
          <Text style={[s.modeHint, { fontFamily: fonts.pixel, color: dim }]}>NO REWARDS YET</Text>
        ) : rewards.map((r) => {
          const afford = available >= r.pointsCost && !redeem.isPending
          return (
            <Pressable
              key={r.id}
              disabled={!afford}
              onPress={() => { setErr(null); redeem.mutate({ rewardId: r.id }) }}
              style={({ pressed }) => [s.rewardRow, { backgroundColor: rowBg, borderColor: rowBorder, borderBottomColor: rowEdge }, !afford && s.rewardRowOff, pressed && s.rewardRowPressed]}
            >
              <Text style={[s.rewardRowName, { fontFamily: fonts.bodyBold, color: ink }]} numberOfLines={1}>{r.title}</Text>
              <Text style={[s.rewardRowCost, { fontFamily: fonts.pixel, color: "#E23B22" }]}>{r.pointsCost}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </LcdScreen>
  )
}

// ── Short H:MM countdown until a redemption code expires ──
function Countdown({ to, dim }: { to: Date; dim: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = Math.max(0, to.getTime() - now)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return (
    <Text style={[s.modeHint, { fontFamily: fonts.pixel, color: dim }]}>
      ⏳ {h}H {String(m).padStart(2, "0")}M LEFT
    </Text>
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
  content: { padding: 18, paddingBottom: 110 },
  afterDevice: { height: 24 },
  // enlarged device bottom — beta signature in pixel font
  deviceFooter: { alignItems: "center", paddingTop: 10, paddingBottom: 16, marginTop: 2 },
  deviceFooterText: { fontSize: 9, letterSpacing: 1.5, color: "#8A887F" },

  // ── Device mode panels (EARN / SPEND) ──
  lcdAnimWrap: { overflow: "hidden", borderRadius: 18 },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  modeTitle: { fontSize: 11, letterSpacing: 1 },
  modeBig: { fontSize: 30, color: "#CFE3C4", marginTop: 6 },
  modeHint: { fontSize: 8, lineHeight: 14, color: "#8A887F", textAlign: "center", marginTop: 8 },
  modeStatsRow: { flexDirection: "row", gap: 28, marginTop: 6 },
  modeStat: { alignItems: "center", gap: 3 },
  modeStatVal: { fontSize: 11, color: "#CFE3C4" },
  modeStatLab: { fontSize: 6, color: "#8A887F", letterSpacing: 0.5 },
  modeErr: { fontSize: 7, lineHeight: 11, color: "#E8917F", textAlign: "center", marginTop: 4 },
  qrBox: { backgroundColor: "#FFFFFF", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#C4C4BE" },
  qrCode: { fontSize: 7, color: "#8A887F", letterSpacing: 0.5, marginTop: 2 },
  rewardScroll: { width: "100%", maxHeight: 150, marginTop: 6 },
  rewardScrollInner: { gap: 6, paddingBottom: 2 },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1B16",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderBottomWidth: 3,
    borderBottomColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  rewardRowOff: { opacity: 0.4 },
  rewardRowPressed: { borderBottomWidth: 1, transform: [{ translateY: 2 }] },
  rewardRowName: { fontSize: 12, color: "#CFE3C4", flex: 1 },
  rewardRowCost: { fontSize: 10, color: "#E8917F" },
  backBar: {
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1A1B16",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0,0,0,0.45)",
  },
  backBarLight: { backgroundColor: "#efeeea", borderColor: "rgba(110,102,86,0.14)", borderBottomColor: "rgba(110,102,86,0.18)" },
  backBarPressed: { borderBottomWidth: 2, transform: [{ translateY: 2 }] },
  backBarText: { fontSize: 9, letterSpacing: 1, color: "#CFCEC6" },
  backBarTextLight: { color: "#75736A" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 6,
    paddingTop: 2,
  },
  helloBlock: { flex: 1 },
  hello: { fontSize: 44, lineHeight: 50, letterSpacing: 0 },
  citySwitch: { flexDirection: "row", gap: 7, marginTop: 6 },
  cityPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  cityPillActive: { backgroundColor: "#FFFFFF", shadowColor: "#C9C4B4", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.32, shadowRadius: 6, elevation: 2 },
  cityPillIdle: { backgroundColor: "rgba(225,230,239,0.68)" },
  cityPillText: { fontSize: 10 },

  profileAvatar: { width: 58, height: 58, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: "#C9C4B4", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  profileAvatarText: { color: "#75736A", fontSize: 24 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionMark: { fontSize: 9, color: "#fd4600" },
  sectionTitle: { color: "#015634", fontSize: 39, lineHeight: 44, letterSpacing: 0 },
  sectionButton: { backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, shadowColor: "#C9C4B4", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
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

  partnerOfferCard: { width: 140, backgroundColor: "#efeeea", borderRadius: 18, padding: 14, gap: 6, borderTopWidth: 1.5, borderTopColor: "rgba(255,255,255,0.95)", borderBottomWidth: 4, borderBottomColor: "rgba(110,102,86,0.16)" },
  partnerOfferPtsBox: { backgroundColor: "#DBDBD7", borderWidth: 1, borderColor: "#C4C4BE", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "baseline", gap: 2 },
  partnerOfferPts: { fontSize: 18, lineHeight: 20 },
  partnerOfferPtsLabel: { fontSize: 10 },
  partnerOfferTitle: { fontSize: 13, lineHeight: 17 },
  partnerOfferVenue: { fontSize: 11 },
  offerPressable: { width: 176 },
  offerCard: { minHeight: 174, borderRadius: 24, padding: 14, overflow: "hidden", backgroundColor: "#efeeea", borderTopWidth: 1.5, borderTopColor: "rgba(255,255,255,0.95)", borderBottomWidth: 5, borderBottomColor: "rgba(110,102,86,0.18)", shadowColor: "#9A958A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 4 },
  offerCardFeatured: { borderBottomColor: "rgba(242,166,110,0.5)" },
  offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  offerLogo: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)" },
  offerLogoText: { fontSize: 16, fontWeight: "900" },
  offerPoints: { backgroundColor: "#DBDBD7", color: "#015634", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#C4C4BE", paddingHorizontal: 9, paddingVertical: 7, fontSize: 8, letterSpacing: 0.5 },
  offerTitle: { fontSize: 21, lineHeight: 23, letterSpacing: 0, minHeight: 48 },
  offerVenue: { fontSize: 12, marginTop: 8 },
  offerLink: { marginTop: "auto", alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)" },
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
  venueName: { color: "#015634", fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8, letterSpacing: 0 },
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
