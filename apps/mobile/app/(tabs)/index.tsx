import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { AyooLogo } from "../../src/components/AyooLogo"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../../src/lib/trpc"
import { fonts, pass } from "../../src/lib/theme"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

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
        <View style={s.cityRow}>
          {CITY_OPTIONS.map((city) => {
            const active = selectedCity.name === city.name
            return (
              <Pressable
                key={city.name}
                onPress={() => updateProfile.mutate({ homeCity: city.name })}
                style={[s.cityPill, active && s.cityPillActive]}
              >
                <Text style={[s.cityPillText, active && s.cityPillTextActive, { fontFamily: fonts.bodyBold }]}>
                  {city.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <AyooLogo width={52} height={30} />
        <Pressable onPress={() => router.push("/earn")} style={s.addBtn}>
          <Text style={[s.addBtnText, { fontFamily: fonts.displayHeavy }]}>+</Text>
        </Pressable>
      </View>

      {/* ── Member Pass Card ── */}
      <View style={s.passWrapper}>
        {/* Dark top */}
        <View style={s.passTop}>
          <View style={s.passTopRow}>
            <View>
              <Text style={[s.passLabel, { fontFamily: fonts.bodyBold }]}>MEMBER PASS</Text>
              <Text style={[s.passName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
                {me.data?.name?.split(" ")[0] ?? "Welcome"}
              </Text>
            </View>
            <View style={s.tierBadge}>
              <Text style={s.tierEmoji}>{tier.emoji}</Text>
              <Text style={[s.tierName, { fontFamily: fonts.bodyBold }]}>{tier.name.toUpperCase()}</Text>
            </View>
          </View>

          <View style={s.pointsBlock}>
            <Text style={[s.pointsNumber, { fontFamily: fonts.displayHeavy }]}>{fmt(total)}</Text>
            <Text style={[s.pointsLabel, { fontFamily: fonts.bodyBold }]}>POINTS</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: fonts.displayHeavy }]}>{streak}</Text>
              <Text style={[s.statLabel, { fontFamily: fonts.bodyBold }]}>DAY STREAK</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: fonts.displayHeavy }]}>{welcomeDays}</Text>
              <Text style={[s.statLabel, { fontFamily: fonts.bodyBold }]}>WELCOME LEFT</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Text style={[s.statValue, { fontFamily: fonts.displayHeavy }]}>{activeChallenges.length}</Text>
              <Text style={[s.statLabel, { fontFamily: fonts.bodyBold }]}>QUESTS</Text>
            </View>
          </View>
        </View>

        {/* Perforation */}
        <Perforation />

        {/* Light bottom */}
        <View style={s.passBottom}>
          <View style={s.passActions}>
            <Pressable onPress={() => router.push("/scan")} style={[s.actionBtn, s.actionBtnOrange]}>
              <Text style={s.actionBtnIcon}>⌁</Text>
              <Text style={[s.actionBtnText, s.actionBtnTextDark, { fontFamily: fonts.bodyBold }]}>{t("scanReceipt")}</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/checkin")} style={[s.actionBtn, s.actionBtnDark]}>
              <Text style={s.actionBtnIcon}>⌖</Text>
              <Text style={[s.actionBtnText, s.actionBtnTextLight, { fontFamily: fonts.bodyBold }]}>{t("checkIn")}</Text>
            </Pressable>
          </View>
          <BarcodeDecor />
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
                  <Text style={[s.partnerPtsNum, { fontFamily: fonts.displayHeavy }]}>+{offer.pointsReward}</Text>
                  <Text style={[s.partnerPtsLabel, { fontFamily: fonts.bodyBold }]}>pts</Text>
                </View>
                <Text style={[s.partnerTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={2}>{offer.title}</Text>
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
              <Text style={[s.filterChipText, isActive && s.filterChipTextActive, { fontFamily: fonts.bodyBold }]}>
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
            <Text style={[s.emptyText, { fontFamily: fonts.bodyBold }]}>
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
      <Text style={[s.sectionTitle, { fontFamily: fonts.displayHeavy }]}>{title}</Text>
      <Pressable onPress={onPress} style={s.sectionBtn}>
        <Text style={[s.sectionBtnText, { fontFamily: fonts.bodyBold }]}>{action} →</Text>
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
        <Text style={[s.offerPoints, { fontFamily: fonts.displayHeavy }]}>{points}</Text>
        <Text style={[s.offerPtsLabel, { fontFamily: fonts.bodyBold }]}>pts</Text>
      </View>
      <View style={s.offerPerf}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View key={i} style={s.offerPerfDash} />
        ))}
      </View>
      <View style={s.offerBottom}>
        <Text style={[s.offerTitle, { fontFamily: fonts.bodyBold }]} numberOfLines={2}>{title}</Text>
        <Text style={s.offerVenue} numberOfLines={1}>{venue}</Text>
        <Text style={[s.offerCta, { fontFamily: fonts.bodyBold }]}>Open ↗</Text>
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
        <Text style={[s.venueLogoText, { fontFamily: fonts.displayHeavy }]}>{initials(name)}</Text>
      </View>
      <View style={s.venueMain}>
        <View style={s.venueTitleRow}>
          <Text style={[s.venueName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{name}</Text>
          <Text style={s.venueArrow}>↗</Text>
        </View>
        <Text style={[s.venueMeta, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {category} · {city}
        </Text>
        <View style={s.venueChips}>
          {rate ? (
            <View style={s.chipOrange}>
              <Text style={[s.chipOrangeText, { fontFamily: fonts.bodyBold }]}>{rate.toFixed(3)} pts/RSD</Text>
            </View>
          ) : null}
          <View style={s.chipGray}>
            <Text style={[s.chipGrayText, { fontFamily: fonts.bodyBold }]}>{distanceLabel(distance)}</Text>
          </View>
          {discount ? (
            <View style={s.chipMint}>
              <Text style={[s.chipMintText, { fontFamily: fonts.bodyBold }]}>-{discount}%</Text>
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
      <View style={[s.venueLogo, { backgroundColor: "rgba(28,43,58,0.12)" }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, width: "60%", backgroundColor: "rgba(28,43,58,0.08)", borderRadius: 6 }} />
        <View style={{ height: 10, width: "40%", backgroundColor: "rgba(28,43,58,0.06)", borderRadius: 6 }} />
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: pass.bg },
  content: { padding: 18, paddingBottom: 110 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cityRow: { flexDirection: "row", gap: 6 },
  cityPill: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(28,43,58,0.08)",
  },
  cityPillActive: { backgroundColor: pass.dark },
  cityPillText: { fontSize: 11, color: pass.textMid },
  cityPillTextActive: { color: pass.textLight },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: pass.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: pass.textLight, fontSize: 22, lineHeight: 26 },

  // Member Pass
  passWrapper: { marginBottom: 24 },

  passTop: {
    backgroundColor: pass.dark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 18,
  },
  passTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  passLabel: {
    color: pass.textFaded,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  passName: {
    color: pass.textLight,
    fontSize: 22,
    lineHeight: 26,
  },
  tierBadge: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    gap: 3,
  },
  tierEmoji: { fontSize: 20 },
  tierName: { color: pass.textLight, fontSize: 9, letterSpacing: 1.5 },

  pointsBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 22,
  },
  pointsNumber: {
    color: pass.textLight,
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -2,
  },
  pointsLabel: {
    color: pass.textFaded,
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 8,
  },

  statsRow: { flexDirection: "row", alignItems: "center" },
  statChip: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.12)" },
  statValue: { color: pass.textLight, fontSize: 20, lineHeight: 22 },
  statLabel: {
    color: pass.textFaded,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
    textAlign: "center",
  },

  // Perforation
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: pass.dark,
    height: 28,
  },
  perfCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: pass.bg,
    marginLeft: -10,
  },
  perfLineWrap: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    overflow: "hidden",
    justifyContent: "center",
  },
  perfDash: { width: 6, height: 1, backgroundColor: pass.perf },
  perfCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: pass.bg,
    marginRight: -10,
  },

  // Pass bottom
  passBottom: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 16,
    gap: 14,
  },
  passActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnOrange: { backgroundColor: pass.orange },
  actionBtnDark: { backgroundColor: pass.dark },
  actionBtnIcon: { fontSize: 18, color: pass.textLight },
  actionBtnText: { fontSize: 13 },
  actionBtnTextDark: { color: "#1C2B3A" },
  actionBtnTextLight: { color: pass.textLight },

  // Barcode
  barcode: {
    flexDirection: "row",
    gap: 2,
    height: 32,
    alignItems: "stretch",
    opacity: 0.18,
  },
  bar: { backgroundColor: pass.dark, borderRadius: 1 },

  // Section head
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: pass.textDark, fontSize: 18, letterSpacing: -0.3 },
  sectionBtn: {
    backgroundColor: pass.dark,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionBtnText: { color: pass.textLight, fontSize: 11 },

  // Offer ticket
  ticketRail: { gap: 10, paddingBottom: 20 },
  offerTicket: {
    width: 148,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: pass.dark,
  },
  offerTop: {
    padding: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  offerPoints: { color: pass.textLight, fontSize: 34, lineHeight: 36, letterSpacing: -1 },
  offerPtsLabel: { color: pass.textFaded, fontSize: 12, marginBottom: 4 },
  offerPerf: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 14,
    marginVertical: 2,
    overflow: "hidden",
  },
  offerPerfDash: { width: 6, height: 1, backgroundColor: "rgba(255,255,255,0.20)" },
  offerBottom: { backgroundColor: "#FFFFFF", padding: 12, gap: 4 },
  offerTitle: { color: pass.textDark, fontSize: 13, lineHeight: 16 },
  offerVenue: { color: pass.textMid, fontSize: 11 },
  offerCta: { color: pass.orange, fontSize: 11, marginTop: 4 },

  // Partner card
  partnerCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: pass.border,
  },
  partnerPts: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  partnerPtsNum: { color: pass.orange, fontSize: 26, lineHeight: 28 },
  partnerPtsLabel: { color: pass.orange, fontSize: 11, marginBottom: 2 },
  partnerTitle: { color: pass.textDark, fontSize: 13, lineHeight: 16 },
  partnerVenue: { color: pass.textMid, fontSize: 11 },

  // Filter chips
  filterRail: { gap: 8, paddingBottom: 12 },
  filterChip: {
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(28,43,58,0.07)",
  },
  filterChipActive: { backgroundColor: pass.dark },
  filterChipText: { color: pass.textMid, fontSize: 12 },
  filterChipTextActive: { color: pass.textLight },

  // Venue row
  venueList: { gap: 8 },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: pass.border,
  },
  venueAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: pass.dark,
  },
  venueLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: pass.dark,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  venueLogoText: { color: pass.textLight, fontSize: 18 },
  venueMain: { flex: 1 },
  venueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  venueName: { color: pass.textDark, fontSize: 15, flex: 1 },
  venueArrow: { color: pass.textMuted, fontSize: 16 },
  venueMeta: { color: pass.textMid, fontSize: 11, marginBottom: 7 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  chipOrange: {
    backgroundColor: pass.orangeLight,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipOrangeText: { color: pass.orange, fontSize: 10 },
  chipGray: {
    backgroundColor: "rgba(28,43,58,0.07)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipGrayText: { color: pass.textMid, fontSize: 10 },
  chipMint: {
    backgroundColor: pass.mint,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipMintText: { color: pass.mintDark, fontSize: 10 },

  // Empty / skeleton
  emptyVenues: { padding: 24, alignItems: "center" },
  emptyText: { color: pass.textMid, fontSize: 13, textAlign: "center" },
})
