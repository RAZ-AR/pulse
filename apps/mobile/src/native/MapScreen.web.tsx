import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { colors, neonColors, fonts, useTheme } from "../lib/theme"
import { LavaLampSurface, VolumeGradient } from "../components/neu"
import { AyooLogo } from "../components/AyooLogo"
import { useColorMode } from "../store/colorMode"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../lib/venues"

const brutal = {
  bg: "#F5F4F0",
  black: "#000000",
  white: "#FFFFFF",
  pink: "#ea5b0c",
  brown: "#806828",
  teal: "#1f71b8",
  lavender: "#B38BC8",
}

function ratingLabel(rating: number | null | undefined, reviews: number | null | undefined) {
  if (!rating) return "Google rating soon"
  return `Google ${rating.toFixed(1)} (${reviews ?? 0})`
}

function distanceLabel(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export default function MapWebScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"

  const [activeFilterKey, setActiveFilterKey] = useState("all")
  const me = trpc.user.me.useQuery()
  const utils = trpc.useUtils()
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const selectedCity = resolveCity(me.data?.homeCity)
  const activeFilter = VENUE_FILTERS.find((filter) => filter.key === activeFilterKey) ?? DEFAULT_VENUE_FILTER
  const venues = trpc.venue.nearby.useQuery({
    lat: selectedCity.lat,
    lng: selectedCity.lng,
    radiusKm: selectedCity.radiusKm,
    ...(activeFilter.category ? { category: activeFilter.category } : {}),
    limit: 50,
  })
  const demoVenues = getDemoVenues(selectedCity.name, activeFilter)
  const visibleVenues = venues.data?.length ? venues.data : demoVenues
  const partnerCount = visibleVenues.filter((venue) => venue.isPartner).length
  const bestRate = visibleVenues.reduce<number | null>((best, venue) => {
    if (!venue.pointsPerCurrency) return best
    return best === null ? venue.pointsPerCurrency : Math.max(best, venue.pointsPerCurrency)
  }, null)

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: theme.bg }]}
      contentContainerStyle={s.content}
    >
      <LavaLampSurface style={s.hero}>
        <View>
          <Text style={[s.kicker, { fontFamily: fonts.bodyBold }]}>NEARBY</Text>
          <Text style={[s.title, { fontFamily: fonts.displayHeavy }]}>
            {t("map", "Map")}
          </Text>
        </View>
        <View style={s.citySwitch}>
          {CITY_OPTIONS.map((city) => {
            const active = selectedCity.name === city.name
            return (
              <Pressable
                key={city.name}
                onPress={() => updateProfile.mutate({ homeCity: city.name })}
                style={[s.locationPill, active ? s.locationPillActive : s.locationPillIdle]}
              >
                <Text style={[s.locationText, { color: active ? brutal.white : colors.ink, fontFamily: fonts.bodyBold }]}>
                  {city.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </LavaLampSurface>

      <View style={[s.mapPanel, theme.shadowRaised]}>
        <View style={s.mapBubbleTop} />
        <View style={s.mapBubbleBottom} />
        <View style={s.mapGrid}>
          {visibleVenues.slice(0, 9).map((venue, index) => (
            <Pressable
              key={venue.id}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
              style={[
                s.pin,
                {
                  left: `${12 + ((index * 29) % 72)}%`,
                  top: `${18 + ((index * 19) % 62)}%`,
                },
                index === 0 && s.pinFeatured,
              ]}
            >
              <Text style={[s.pinText, { fontFamily: fonts.displayHeavy }]}>
                {venue.name.slice(0, 1).toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.mapStats}>
          <View style={s.mapStat}>
            <Text style={[s.mapStatValue, { fontFamily: fonts.displayHeavy }]}>{visibleVenues.length}</Text>
            <Text style={[s.mapStatLabel, { fontFamily: fonts.bodyBold }]}>venues</Text>
          </View>
          <View style={s.mapStat}>
            <Text style={[s.mapStatValue, { fontFamily: fonts.displayHeavy }]}>{partnerCount}</Text>
            <Text style={[s.mapStatLabel, { fontFamily: fonts.bodyBold }]}>partners</Text>
          </View>
          <View style={s.mapStat}>
            <Text style={[s.mapStatValue, { fontFamily: fonts.displayHeavy }]}>
              {bestRate ? bestRate.toFixed(3) : "—"}
            </Text>
            <Text style={[s.mapStatLabel, { fontFamily: fonts.bodyBold }]}>best pts</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {VENUE_FILTERS.map((filter) => {
          const active = filter.key === activeFilterKey
          if (active && isRainbow) {
            return (
              <VolumeGradient key={filter.key} colors={["#2B6EFF", "#8B3DFF", "#FF2D9B"]} shadowColor="#8B3DFF" style={s.filterChip}>
                <Pressable onPress={() => setActiveFilterKey(filter.key)} style={s.filterChipInner}>
                  <Text style={[s.filterText, { color: "#FFFFFF", fontFamily: fonts.bodyBold }]}>{filter.label}</Text>
                </Pressable>
              </VolumeGradient>
            )
          }
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilterKey(filter.key)}
              style={[s.filterChip, active ? (isRainbow ? s.filterChipActiveRainbow : s.filterChipActive) : s.filterChipIdle]}
            >
              <Text style={[s.filterText, { color: active && !isRainbow ? brutal.white : active && isRainbow ? neonColors.cyan : colors.ink, fontFamily: fonts.bodyBold }]}>
                {filter.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={s.list}>
        {visibleVenues.map((venue) => (
          <Pressable
            key={venue.id}
            style={[s.card, isRainbow && s.cardRainbow]}
            onPress={() =>
              router.push({ pathname: "/venue/[id]", params: { id: venue.id } })
            }
          >
            <View style={s.row}>
              <View style={[s.logo, isRainbow && s.logoRainbow]}>
                <AyooLogo width={54} height={25} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text
                    style={[s.name, { fontFamily: fonts.displayHeavy, color: isRainbow ? "#1A1A2E" : colors.ink }]}
                    numberOfLines={1}
                  >
                    {venue.name}
                  </Text>
                  <Text style={[s.arrow, { color: isRainbow ? neonColors.purple : colors.ink }]}>↗</Text>
                </View>
                <Text style={s.meta} numberOfLines={1}>
                  {t(`category.${venue.category}`, venue.category.toLowerCase())} ·{" "}
                  {venue.city}
                </Text>
                <Text style={s.address} numberOfLines={1}>
                  {venue.address}
                </Text>
                <Text style={s.description} numberOfLines={2}>
                  {venue.description ?? "Contacts, website and Instagram will appear after source import."}
                </Text>
                <View style={s.chips}>
                  <View style={[s.darkChip, isRainbow && s.darkChipRainbow]}>
                    <Text style={[s.darkChipText, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.pink : colors.ink }]}>
                      {venue.pointsPerCurrency
                        ? `${venue.pointsPerCurrency.toFixed(3)} pts/RSD`
                        : t("receiptScan")}
                    </Text>
                  </View>
                  <View style={[s.lightChip, isRainbow && s.lightChipRainbow]}>
                    <Text style={[s.lightChipText, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.muted : colors.ink }]}>
                      {distanceLabel(venue.distanceMeters)}
                    </Text>
                  </View>
                  <View style={[s.lightChip, isRainbow && s.lightChipRainbow]}>
                    <Text style={[s.lightChipText, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.muted : colors.ink }]}>
                      {ratingLabel(venue.googleRating, venue.googleReviews)}
                    </Text>
                  </View>
                  {venue.enableDiscount ? (
                    <Text
                      style={[
                        s.discountChip,
                        s.discountChipText,
                        isRainbow && s.discountChipRainbow,
                        { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.green : brutal.white },
                      ]}
                    >
                      up to {venue.maxDiscountPercent}% off
                    </Text>
                  ) : null}
                  <View style={[s.sourceChip, isRainbow && s.sourceChipRainbow]}>
                    <Text style={[s.sourceChipText, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.cyan : colors.ink }]}>
                      open sources ready
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {venues.isLoading ? (
        <Text style={[s.empty, { color: theme.textSecondary }]}>
          {t("common:loading")}
        </Text>
      ) : venues.data?.length === 0 ? (
        <Text style={[s.empty, { color: theme.textSecondary }]}>
          {t("noVenuesYet")}
        </Text>
      ) : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  hero: {
    borderRadius: 8,
    padding: 18,
    minHeight: 164,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  kicker: {
    color: brutal.black,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  title: { color: brutal.black, fontSize: 38, lineHeight: 42 },
  citySwitch: { gap: 8, alignItems: "flex-end" },
  locationPill: { minHeight: 38, borderRadius: 4, paddingHorizontal: 14, justifyContent: "center", borderWidth: 2, borderColor: brutal.black },
  locationPillActive: { backgroundColor: brutal.teal },
  locationPillIdle: { backgroundColor: brutal.white },
  locationText: { fontSize: 12 },
  filters: { gap: 8, paddingBottom: 14 },
  filterChip: { borderRadius: 4, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 2, borderColor: brutal.black },
  filterChipInner: { paddingHorizontal: 0, paddingVertical: 0, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: brutal.teal },
  filterChipActiveRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: brutal.white },
  filterText: { fontSize: 11 },
  list: { gap: 12 },
  mapPanel: {
    minHeight: 270,
    borderRadius: 8,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: brutal.black,
    backgroundColor: brutal.white,
  },
  mapBubbleTop: {
    position: "absolute",
    top: -70,
    right: -34,
    width: 190,
    height: 190,
    borderRadius: 0,
    backgroundColor: brutal.lavender,
  },
  mapBubbleBottom: {
    position: "absolute",
    bottom: 58,
    left: -44,
    width: 180,
    height: 180,
    borderRadius: 0,
    backgroundColor: brutal.pink,
  },
  mapGrid: {
    flex: 1,
    margin: 16,
    borderRadius: 4,
    backgroundColor: brutal.bg,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: brutal.black,
  },
  pin: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brutal.teal,
    shadowColor: brutal.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    borderWidth: 2,
    borderColor: brutal.black,
  },
  pinFeatured: {
    width: 54,
    height: 54,
    borderRadius: 4,
    backgroundColor: brutal.pink,
  },
  pinFeaturedRainbow: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(139,61,255,0.22)",
    borderColor: "rgba(139,61,255,0.44)",
  },
  pinText: { color: brutal.white, fontSize: 16 },
  mapStats: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  mapStat: {
    flex: 1,
    minHeight: 64,
    borderRadius: 4,
    backgroundColor: brutal.white,
    borderWidth: 2,
    borderColor: brutal.black,
    alignItems: "center",
    justifyContent: "center",
  },
  mapStatValue: { color: colors.ink, fontSize: 24, lineHeight: 26 },
  mapStatLabel: { color: brutal.black, fontSize: 9, textTransform: "uppercase", marginTop: 4 },
  card: { backgroundColor: brutal.white, borderRadius: 8, padding: 12, borderWidth: 3, borderColor: brutal.black, shadowColor: brutal.black, shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 },
  cardRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOpacity: 0.14 },
  row: { flexDirection: "row", gap: 12 },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 4,
    backgroundColor: brutal.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: brutal.black,
  },
  logoRainbow: { backgroundColor: "rgba(43,110,255,0.12)" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: { color: colors.ink, fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8 },
  arrow: { color: colors.ink, fontSize: 21 },
  meta: {
    color: brutal.black,
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  address: { color: brutal.black, fontSize: 12, marginTop: 2 },
  description: { color: brutal.black, fontSize: 12, lineHeight: 16, marginTop: 8 },
  chips: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  darkChip: {
    backgroundColor: brutal.pink,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkChipText: { color: colors.ink, fontSize: 10 },
  lightChip: {
    backgroundColor: brutal.lavender,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lightChipText: { color: colors.ink, fontSize: 10 },
  discountChip: {
    backgroundColor: brutal.teal,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discountChipText: { color: brutal.white, fontSize: 10 },
  sourceChip: {
    backgroundColor: brutal.white,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceChipText: { color: colors.ink, fontSize: 10 },
  darkChipRainbow: { backgroundColor: "rgba(255,45,155,0.12)" },
  lightChipRainbow: { backgroundColor: "rgba(43,110,255,0.10)" },
  discountChipRainbow: { backgroundColor: "rgba(57,255,20,0.12)" },
  sourceChipRainbow: { backgroundColor: "rgba(43,110,255,0.10)" },
  empty: { textAlign: "center", marginTop: 24 },
})
