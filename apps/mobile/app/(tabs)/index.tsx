import { useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from "react-native"
import { AyooLogo } from "../../src/components/AyooLogo"
import { AyooPet } from "../../src/components/AyooPet"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../../src/lib/trpc"
import { fonts } from "../../src/lib/theme"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

const ticketColors = {
  black: "#000000",
  white: "#FFFFFF",
  bg: "#F5F4F0",
  blue: "#273AA8",
  pink: "#ea5b0c",
  brown: "#806828",
  teal: "#1f71b8",
  lavender: "#B38BC8",
  inkSoft: "rgba(0,0,0,0.62)",
  whiteSoft: "rgba(255,255,255,0.72)",
  whiteFaint: "rgba(255,255,255,0.18)",
}

const ticketFonts = {
  display: fonts.displayBlack,
  body: fonts.body,
  bodyBold: fonts.bodyBold,
}

const webTextBreak = Platform.OS === "web"
  ? ({ overflowWrap: "anywhere", wordBreak: "break-word" } as unknown as TextStyle)
  : null

// ── Helpers ───────────────────────────────────────────────────

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

function initials(name: string | null | undefined) {
  return (name ?? "?").slice(0, 1).toUpperCase()
}

function userTier(points: number) {
  if (points <= 1000) return { name: "Sprout",  emoji: "🌱" }
  if (points <= 3000) return { name: "Flower",  emoji: "🌸" }
  if (points <= 5000) return { name: "Garnet",  emoji: "🍎" }
  if (points <= 7000) return { name: "Ruby",    emoji: "💎" }
  return               { name: "Diamond", emoji: "✦" }
}

// ── Decorative components ──────────────────────────────────────

function Perforation() {
  return (
    <View style={s.perfRow}>
      <View style={s.perfCutLeft} />
      <View style={s.perfLineWrap}>
        {Array.from({ length: 36 }).map((_, i) => (
          <View key={i} style={s.perfDash} />
        ))}
      </View>
      <View style={s.perfCutRight} />
    </View>
  )
}

function BarcodeDecor() {
  const bars = [3,1,2,1,4,1,2,3,1,2,1,3,1,2,4,1,2,1,3,2,1,4,1,2,1,3,1,2,4,1,2,3,1,2,1]
  return (
    <View style={s.barcode}>
      {bars.map((w, i) => (
        <View key={i} style={[s.bar, { width: w * 2.2 }]} />
      ))}
    </View>
  )
}

function TicketDots() {
  return (
    <View style={s.dotField} pointerEvents="none">
      {Array.from({ length: 38 }).map((_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            {
              left: `${(i * 23) % 96}%`,
              top: `${(i * 37) % 92}%`,
              opacity: i % 3 === 0 ? 0.18 : 0.09,
            },
          ]}
        />
      ))}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────

type RewardItem = {
  id: string
  title: string
  pointsCost: number
  venue: { id: string; name: string }
}

export default function HomeScreen() {
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
  const partnerOffers = trpc.offer.list.useQuery({ city: selectedCity.name, limit: 6 })
  const activeFilter = VENUE_FILTERS.find((f) => f.key === activeFilterKey) ?? DEFAULT_VENUE_FILTER
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
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)
  const streak = me.data?.currentStreak ?? 0

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      scrollEventThrottle={16}
      removeClippedSubviews
    >
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <View>
          <Text style={[s.kicker, { fontFamily: ticketFonts.bodyBold }]}>AYOO MINIAPP</Text>
          <Text style={[s.screenTitle, { fontFamily: ticketFonts.display }]}>Your pass</Text>
        </View>
        <AyooLogo width={66} height={30} />
      </View>

      <View style={s.cityRow}>
          {CITY_OPTIONS.map((city) => {
            const active = selectedCity.name === city.name
            return (
              <Pressable
                key={city.name}
                onPress={() => updateProfile.mutate({ homeCity: city.name })}
                style={[s.cityPill, active && s.cityPillActive]}
              >
                <Text style={[s.cityPillText, active && s.cityPillTextActive, { fontFamily: ticketFonts.bodyBold }]}>
                  {city.label}
                </Text>
              </Pressable>
            )
          })}
        <Pressable onPress={() => router.push("/earn")} style={s.addBtn}>
          <Text style={[s.addBtnText, { fontFamily: ticketFonts.display }]}>+</Text>
        </Pressable>
      </View>

      {/* ── Member Pass Card ── */}
      <View style={s.passWrapper}>
        {/* Ticket top */}
        <View style={s.passTop}>
          <TicketDots />
          <View style={s.passTopRow}>
            <View style={s.passNameWrap}>
              <Text style={[s.passLabel, { fontFamily: ticketFonts.bodyBold }]}>MEMBER PASS</Text>
              <Text style={[s.passName, webTextBreak, { fontFamily: ticketFonts.display }]} numberOfLines={2}>
                {me.data?.name?.split(" ")[0] ?? "AYOO"}
              </Text>
            </View>
            <View style={s.tierBadge}>
              <Text style={s.tierEmoji}>#{String(lifetimePoints || 500).slice(0, 4).padStart(4, "0")}</Text>
              <Text style={[s.tierName, { fontFamily: ticketFonts.bodyBold }]}>{tier.name.toUpperCase()}</Text>
            </View>
          </View>

          <View style={s.pointsBlock}>
            <View style={s.passPetSpot}>
              <AyooPet
                lifetimePoints={me.data?.totalEarnedLifetime ?? 0}
                streak={streak}
                petName={me.data?.petName}
                pixelSize={6}
                showProgress={false}
                onPress={() => router.push("/pet")}
              />
            </View>
            <View style={s.pointsSide}>
              <Text style={[s.pointsLabel, { fontFamily: ticketFonts.bodyBold }]}>POINTS</Text>
              <Text style={[s.pointsCaption, { fontFamily: ticketFonts.bodyBold }]}>VALID MEMBER CREDIT</Text>
            </View>
            <Text style={[s.pointsNumber, { fontFamily: ticketFonts.display }]} numberOfLines={1}>
              {fmt(total)}
            </Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: ticketFonts.display }]}>{streak}</Text>
              <Text style={[s.statLabel, { fontFamily: ticketFonts.bodyBold }]}>DAY STREAK</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: ticketFonts.display }]}>{welcomeDays}</Text>
              <Text style={[s.statLabel, { fontFamily: ticketFonts.bodyBold }]}>WELCOME LEFT</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: ticketFonts.display }]}>{activeChallenges.length}</Text>
              <Text style={[s.statLabel, { fontFamily: ticketFonts.bodyBold }]}>QUESTS</Text>
            </View>
          </View>
        </View>

        {/* Perforation */}
        <Perforation />

        {/* Light bottom */}
        <View style={s.passBottom}>
          <View style={s.memberMeta}>
            <View>
              <Text style={[s.metaLabel, { fontFamily: ticketFonts.bodyBold }]}>MEMBER SINCE</Text>
              <Text style={[s.metaValue, { fontFamily: ticketFonts.bodyBold }]}>06.2026</Text>
            </View>
            <View>
              <Text style={[s.metaLabel, { fontFamily: ticketFonts.bodyBold }]}>WELCOME LEFT</Text>
              <Text style={[s.metaValue, { fontFamily: ticketFonts.bodyBold }]}>{welcomeDays} DAYS</Text>
            </View>
          </View>
          <BarcodeDecor />
          <View style={s.passActions}>
            <Pressable onPress={() => router.push("/scan")} style={[s.actionBtn, s.actionBtnOrange]}>
              <Text style={s.actionBtnIcon}>⌁</Text>
              <Text style={[s.actionBtnText, s.actionBtnTextDark, { fontFamily: ticketFonts.bodyBold }]}>{t("scanReceipt")}</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/checkin")} style={[s.actionBtn, s.actionBtnDark]}>
              <Text style={s.actionBtnIcon}>⌖</Text>
              <Text style={[s.actionBtnText, s.actionBtnTextLight, { fontFamily: ticketFonts.bodyBold }]}>{t("checkIn")}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Special Offers ── */}
      {rewardItems.length > 0 && (
        <>
          <SectionHead
            title={t("specialOffers")}
            action={t("allRewards")}
            onPress={() => router.push("/rewards")}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ticketRail}>
            {rewardItems.slice(0, 6).map((reward) => (
              <OfferTicket
                key={reward.id}
                title={reward.title}
                venue={reward.venue.name}
                points={reward.pointsCost}
                onPress={() => router.push({ pathname: "/reward/[id]", params: { id: reward.id } })}
              />
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Partner Bonuses ── */}
      {(partnerOffers.data?.offers ?? []).length > 0 && (
        <>
          <SectionHead
            title={t("partnerBonuses", "Partner Bonuses")}
            action={t("seeAll", "See all")}
            onPress={() => router.push("/map")}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ticketRail}>
            {(partnerOffers.data?.offers ?? []).map((offer) => (
              <Pressable
                key={offer.id}
                onPress={() => router.push({ pathname: "/venue/[id]", params: { id: offer.venue.id } })}
                style={s.partnerCard}
              >
                <View style={s.partnerPts}>
                  <Text style={[s.partnerPtsNum, { fontFamily: ticketFonts.display }]}>+{offer.pointsReward}</Text>
                  <Text style={[s.partnerPtsLabel, { fontFamily: ticketFonts.bodyBold }]}>pts</Text>
                </View>
                <Text style={[s.partnerTitle, { fontFamily: ticketFonts.bodyBold }]} numberOfLines={2}>{offer.title}</Text>
                <Text style={s.partnerVenue} numberOfLines={1}>{offer.venue.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Venues Nearby ── */}
      <SectionHead
        title={t("venuesNearby")}
        action={t("nav.map")}
        onPress={() => router.push("/map")}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
        {VENUE_FILTERS.map((filter) => {
          const isActive = filter.key === activeFilterKey
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilterKey(filter.key)}
              style={[s.filterChip, isActive && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, isActive && s.filterChipTextActive, { fontFamily: ticketFonts.bodyBold }]}>
                {filter.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={s.venueList}>
        {nearby.isLoading && (
          <>
            <VenueSkeleton />
            <VenueSkeleton />
          </>
        )}
        {!nearby.isLoading && visibleNearby.length === 0 && (
          <View style={s.emptyVenues}>
            <Text style={[s.emptyText, { fontFamily: ticketFonts.bodyBold }]}>
              {selectedCity.label}: {t("venue:noVenuesYet", "No venues yet")}
            </Text>
          </View>
        )}
        {visibleNearby.slice(0, 6).map((venue) => {
          const offer = rewardItems.find((r) => r.venue.id === venue.id)
          return (
            <VenueRow
              key={venue.id}
              name={venue.name}
              category={t(`venue:category.${venue.category}`, venue.category.toLowerCase())}
              city={venue.city}
              rate={venue.pointsPerCurrency ?? null}
              distance={venue.distanceMeters}
              discount={venue.enableDiscount ? venue.maxDiscountPercent : null}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
            />
          )
        })}
      </View>
    </ScrollView>
  )
}

// ── Sub-components ────────────────────────────────────────────

function SectionHead({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, webTextBreak, { fontFamily: ticketFonts.display }]}>{title}</Text>
      <Pressable onPress={onPress} style={s.sectionBtn}>
        <Text style={[s.sectionBtnText, { fontFamily: ticketFonts.bodyBold }]}>{action} →</Text>
      </Pressable>
    </View>
  )
}

function OfferTicket({
  title, venue, points, onPress,
}: { title: string; venue: string; points: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.offerTicket}>
      <View style={s.offerTop}>
        <Text style={[s.offerPoints, { fontFamily: ticketFonts.display }]}>{points}</Text>
        <Text style={[s.offerPtsLabel, { fontFamily: ticketFonts.bodyBold }]}>pts</Text>
      </View>
      <View style={s.offerPerf}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View key={i} style={s.offerPerfDash} />
        ))}
      </View>
      <View style={s.offerBottom}>
        <Text style={[s.offerTitle, { fontFamily: ticketFonts.bodyBold }]} numberOfLines={2}>{title}</Text>
        <Text style={s.offerVenue} numberOfLines={1}>{venue}</Text>
        <Text style={[s.offerCta, { fontFamily: ticketFonts.bodyBold }]}>Open ↗</Text>
      </View>
    </Pressable>
  )
}

function VenueRow({
  name, category, city, rate, distance, discount, onPress,
}: {
  name: string; category: string; city: string
  rate: number | null; distance: number
  discount: number | null; onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={s.venueRow}>
      <View style={s.venueAccent} />
      <View style={s.venueLogo}>
        <AyooLogo width={40} height={18} />
      </View>
      <View style={s.venueMain}>
        <View style={s.venueTitleRow}>
          <Text style={[s.venueName, { fontFamily: ticketFonts.display }]} numberOfLines={1}>{name}</Text>
          <Text style={s.venueArrow}>↗</Text>
        </View>
        <Text style={[s.venueMeta, { fontFamily: ticketFonts.bodyBold }]} numberOfLines={1}>
          {category} · {city}
        </Text>
        <View style={s.venueChips}>
          {rate ? (
            <View style={s.chipOrange}>
              <Text style={[s.chipOrangeText, { fontFamily: ticketFonts.bodyBold }]}>{rate.toFixed(3)} pts/RSD</Text>
            </View>
          ) : null}
          <View style={s.chipGray}>
            <Text style={[s.chipGrayText, { fontFamily: ticketFonts.bodyBold }]}>{distanceLabel(distance)}</Text>
          </View>
          {discount ? (
            <View style={s.chipMint}>
              <Text style={[s.chipMintText, { fontFamily: ticketFonts.bodyBold }]}>-{discount}%</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

function VenueSkeleton() {
  return (
    <View style={[s.venueRow, { opacity: 0.35 }]}>
      <View style={s.venueAccent} />
      <View style={[s.venueLogo, { backgroundColor: ticketColors.whiteFaint }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, width: "60%", backgroundColor: ticketColors.whiteFaint, borderRadius: 6 }} />
        <View style={{ height: 10, width: "40%", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 6 }} />
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ticketColors.bg },
  content: { padding: 14, paddingBottom: 118 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingTop: 2,
  },
  kicker: {
    color: ticketColors.black,
    fontSize: 10,
    letterSpacing: 2,
  },
  screenTitle: {
    color: ticketColors.black,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: 0,
  },
  cityRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    alignItems: "center",
  },
  cityPill: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: ticketColors.white,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  cityPillActive: { backgroundColor: ticketColors.teal },
  cityPillText: { fontSize: 11, color: ticketColors.black },
  cityPillTextActive: { color: ticketColors.white },
  addBtn: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: ticketColors.pink,
    borderWidth: 2,
    borderColor: ticketColors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: ticketColors.black, fontSize: 22, lineHeight: 25 },

  // Member Pass
  passWrapper: {
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: ticketColors.black,
    shadowColor: ticketColors.black,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 12,
  },

  passTop: {
    backgroundColor: ticketColors.pink,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    padding: 14,
    paddingBottom: 14,
    minHeight: 420,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  passTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    minHeight: 78,
    paddingRight: 98,
  },
  passNameWrap: { flex: 1, minWidth: 0 },
  passLabel: {
    color: "rgba(0,0,0,0.62)",
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  passName: {
    color: ticketColors.black,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  tierBadge: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: ticketColors.black,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 76,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  tierEmoji: { fontSize: 12, color: ticketColors.white },
  tierName: { color: ticketColors.white, fontSize: 9, letterSpacing: 1.4, marginTop: 2 },

  pointsBlock: {
    minHeight: 230,
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  passPetSpot: { alignSelf: "center", marginBottom: 20 },
  pointsNumber: {
    color: ticketColors.black,
    fontSize: 80,
    lineHeight: 78,
    letterSpacing: 0,
  },
  pointsSide: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  pointsLabel: {
    color: ticketColors.black,
    fontSize: 14,
    letterSpacing: 2,
  },
  pointsCaption: {
    color: "rgba(0,0,0,0.58)",
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 3,
  },

  statsRow: { flexDirection: "row", alignItems: "center" },
  statChip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: ticketColors.lavender,
    borderRadius: 4,
    paddingVertical: 7,
    marginHorizontal: 3,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  statDivider: { width: 0, height: 28 },
  statValue: { color: ticketColors.black, fontSize: 20, lineHeight: 22 },
  statLabel: {
    color: "rgba(0,0,0,0.58)",
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
    textAlign: "center",
  },

  dotField: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  dot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 0,
    backgroundColor: ticketColors.black,
  },

  // Perforation
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ticketColors.pink,
    height: 28,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: ticketColors.black,
  },
  perfCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ticketColors.bg,
    marginLeft: -10,
  },
  perfLineWrap: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    overflow: "hidden",
    justifyContent: "center",
  },
  perfDash: { width: 7, height: 2, backgroundColor: "rgba(0,0,0,0.35)" },
  perfCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ticketColors.bg,
    marginRight: -10,
  },

  // Pass bottom
  passBottom: {
    backgroundColor: ticketColors.white,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    padding: 18,
    gap: 14,
  },
  memberMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  metaLabel: {
    color: "rgba(0,0,0,0.48)",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaValue: {
    color: ticketColors.black,
    fontSize: 13,
    marginTop: 3,
  },
  passActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  actionBtnOrange: { backgroundColor: ticketColors.teal },
  actionBtnDark: { backgroundColor: ticketColors.black },
  actionBtnIcon: { fontSize: 18, color: ticketColors.white },
  actionBtnText: { fontSize: 13 },
  actionBtnTextDark: { color: ticketColors.white },
  actionBtnTextLight: { color: ticketColors.white },

  // Barcode
  barcode: {
    flexDirection: "row",
    gap: 2,
    height: 44,
    alignItems: "stretch",
    opacity: 0.92,
  },
  bar: { backgroundColor: ticketColors.black, borderRadius: 1 },

  // Section head
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: { color: ticketColors.black, fontSize: 23, lineHeight: 27, letterSpacing: 0, flex: 1, minWidth: 0 },
  sectionBtn: {
    backgroundColor: ticketColors.white,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: ticketColors.black,
    flexShrink: 0,
  },
  sectionBtnText: { color: ticketColors.black, fontSize: 11 },

  // Offer ticket
  ticketRail: { gap: 10, paddingBottom: 20 },
  offerTicket: {
    width: 164,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: ticketColors.pink,
    borderWidth: 3,
    borderColor: ticketColors.black,
  },
  offerTop: {
    padding: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  offerPoints: { color: ticketColors.black, fontSize: 40, lineHeight: 40, letterSpacing: 0 },
  offerPtsLabel: { color: "rgba(0,0,0,0.58)", fontSize: 12, marginBottom: 4 },
  offerPerf: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 14,
    marginVertical: 2,
    overflow: "hidden",
  },
  offerPerfDash: { width: 6, height: 2, backgroundColor: "rgba(0,0,0,0.26)" },
  offerBottom: { backgroundColor: ticketColors.white, padding: 13, gap: 5, borderTopWidth: 3, borderColor: ticketColors.black },
  offerTitle: { color: ticketColors.black, fontSize: 16, lineHeight: 18 },
  offerVenue: { color: "rgba(0,0,0,0.58)", fontSize: 11 },
  offerCta: { color: ticketColors.black, fontSize: 11, marginTop: 4 },

  // Partner card
  partnerCard: {
    width: 156,
    backgroundColor: ticketColors.lavender,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    borderWidth: 3,
    borderColor: ticketColors.black,
  },
  partnerPts: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  partnerPtsNum: { color: ticketColors.black, fontSize: 30, lineHeight: 30 },
  partnerPtsLabel: { color: ticketColors.black, fontSize: 11, marginBottom: 2 },
  partnerTitle: { color: ticketColors.black, fontSize: 14, lineHeight: 17 },
  partnerVenue: { color: ticketColors.black, fontSize: 11 },

  // Filter chips
  filterRail: { gap: 8, paddingBottom: 12 },
  filterChip: {
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: ticketColors.white,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  filterChipActive: { backgroundColor: ticketColors.teal },
  filterChipText: { color: ticketColors.black, fontSize: 12 },
  filterChipTextActive: { color: ticketColors.white },

  // Venue row
  venueList: { gap: 8 },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ticketColors.white,
    borderRadius: 8,
    overflow: "hidden",
    padding: 14,
    gap: 12,
    borderWidth: 3,
    borderColor: ticketColors.black,
  },
  venueAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: ticketColors.brown,
  },
  venueLogo: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: ticketColors.white,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    borderWidth: 2,
    borderColor: ticketColors.black,
  },
  venueMain: { flex: 1 },
  venueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  venueName: { color: ticketColors.black, fontSize: 17, flex: 1 },
  venueArrow: { color: ticketColors.black, fontSize: 16 },
  venueMeta: { color: ticketColors.black, fontSize: 11, marginBottom: 7 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  chipOrange: {
    backgroundColor: ticketColors.pink,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipOrangeText: { color: ticketColors.black, fontSize: 10 },
  chipGray: {
    backgroundColor: ticketColors.lavender,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipGrayText: { color: ticketColors.black, fontSize: 10 },
  chipMint: {
    backgroundColor: ticketColors.teal,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipMintText: { color: ticketColors.white, fontSize: 10 },

  // Empty / skeleton
  emptyVenues: { padding: 24, alignItems: "center" },
  emptyText: { color: ticketColors.black, fontSize: 13, textAlign: "center" },
})
