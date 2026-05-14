import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { colors, neonColors, fonts, useTheme } from "../lib/theme"
import { LavaLampSurface, VolumeGradient } from "../components/neu"
import { useColorMode } from "../store/colorMode"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../lib/venues"

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
                <Text style={[s.locationText, { color: colors.ink, fontFamily: fonts.bodyBold }]}>
                  {city.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </LavaLampSurface>

      <View style={[s.mapPanel, theme.shadowRaised]}>
        <LinearGradient
          colors={["rgba(235,254,255,0.96)", "rgba(255,244,254,0.82)", "rgba(236,255,235,0.86)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
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
                index === 0 && (isRainbow ? s.pinFeaturedRainbow : s.pinFeatured),
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
              <Text style={[s.filterText, { color: active && isRainbow ? neonColors.cyan : colors.ink, fontFamily: fonts.bodyBold }]}>
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
                <Text style={[s.logoText, { fontFamily: fonts.displayHeavy, color: isRainbow ? neonColors.cyan : colors.ink }]}>
                  {venue.name.slice(0, 1).toUpperCase()}
                </Text>
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
                    <View style={[s.discountChip, isRainbow && s.discountChipRainbow]}>
                      <Text style={[s.discountChipText, { fontFamily: fonts.bodyBold, color: isRainbow ? neonColors.green : colors.ink }]}>
                        up to {venue.maxDiscountPercent}% off
                      </Text>
                    </View>
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
  content: { padding: 18, paddingBottom: 34 },
  hero: {
    borderRadius: 32,
    padding: 18,
    minHeight: 164,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  kicker: {
    color: "#B0D4E3",
    fontSize: 11,
    letterSpacing: 1.8,
  },
  title: { color: "#6E7D8E", fontSize: 38, lineHeight: 42 },
  citySwitch: { gap: 8, alignItems: "flex-end" },
  locationPill: { minHeight: 38, borderRadius: 99, paddingHorizontal: 14, justifyContent: "center" },
  locationPillActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  locationPillIdle: { backgroundColor: "rgba(255,255,255,0.82)" },
  locationText: { fontSize: 12 },
  filters: { gap: 8, paddingBottom: 14 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipInner: { paddingHorizontal: 0, paddingVertical: 0, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  filterChipActiveRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: "rgba(249,251,255,0.62)" },
  filterText: { fontSize: 11 },
  list: { gap: 12 },
  mapPanel: {
    minHeight: 270,
    borderRadius: 40,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "#F9FBFF",
  },
  mapBubbleTop: {
    position: "absolute",
    top: -70,
    right: -34,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.44)",
  },
  mapBubbleBottom: {
    position: "absolute",
    bottom: 58,
    left: -44,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(249,251,255,0.34)",
  },
  mapGrid: {
    flex: 1,
    margin: 16,
    borderRadius: 30,
    backgroundColor: "rgba(249,251,255,0.34)",
    overflow: "hidden",
  },
  pin: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 9,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
  },
  pinFeatured: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,244,254,0.92)",
  },
  pinFeaturedRainbow: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(139,61,255,0.22)",
    borderColor: "rgba(139,61,255,0.44)",
  },
  pinText: { color: colors.ink, fontSize: 16 },
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
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.70)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapStatValue: { color: colors.ink, fontSize: 24, lineHeight: 26 },
  mapStatLabel: { color: "#91A1B4", fontSize: 9, textTransform: "uppercase", marginTop: 4 },
  card: { backgroundColor: "#F9FBFF", borderRadius: 34, padding: 12, shadowColor: "#A3B1C6", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 2 },
  cardRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOpacity: 0.14 },
  row: { flexDirection: "row", gap: 12 },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: "rgba(235,254,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoRainbow: { backgroundColor: "rgba(43,110,255,0.12)" },
  logoText: { color: colors.ink, fontSize: 22 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: { color: colors.ink, fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8 },
  arrow: { color: colors.ink, fontSize: 21 },
  meta: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  address: { color: "#8E95A3", fontSize: 12, marginTop: 2 },
  description: { color: "#91A1B4", fontSize: 12, lineHeight: 16, marginTop: 8 },
  chips: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  darkChip: {
    backgroundColor: "rgba(255,244,254,0.92)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkChipText: { color: colors.ink, fontSize: 10 },
  lightChip: {
    backgroundColor: "#EEF3FB",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lightChipText: { color: colors.ink, fontSize: 10 },
  discountChip: {
    backgroundColor: "rgba(236,255,235,0.88)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discountChipText: { color: colors.ink, fontSize: 10 },
  sourceChip: {
    backgroundColor: "rgba(235,254,255,0.88)",
    borderRadius: 99,
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
