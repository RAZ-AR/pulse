import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { colors, fonts, useTheme } from "../lib/theme"
import { LavaLampSurface } from "../components/neu"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, resolveCity, VENUE_FILTERS } from "../lib/venues"

export default function MapWebScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()

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
                <Text style={[s.locationText, { color: active ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
                  {city.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </LavaLampSurface>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {VENUE_FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilterKey(filter.key)}
            style={[s.filterChip, filter.key === activeFilterKey ? s.filterChipActive : s.filterChipIdle]}
          >
            <Text style={[s.filterText, { color: filter.key === activeFilterKey ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.list}>
        {(venues.data ?? []).map((venue) => (
          <Pressable
            key={venue.id}
            style={s.card}
            onPress={() =>
              router.push({ pathname: "/venue/[id]", params: { id: venue.id } })
            }
          >
            <View style={s.row}>
              <View style={s.logo}>
                <Text style={[s.logoText, { fontFamily: fonts.displayHeavy }]}>
                  {venue.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text
                    style={[s.name, { fontFamily: fonts.displayHeavy }]}
                    numberOfLines={1}
                  >
                    {venue.name}
                  </Text>
                  <Text style={s.arrow}>↗</Text>
                </View>
                <Text style={s.meta} numberOfLines={1}>
                  {t(`category.${venue.category}`, venue.category.toLowerCase())} ·{" "}
                  {venue.city}
                </Text>
                <Text style={s.address} numberOfLines={1}>
                  {venue.address}
                </Text>
                <View style={s.chips}>
                  <View style={s.darkChip}>
                    <Text style={[s.darkChipText, { fontFamily: fonts.bodyBold }]}>
                      {venue.pointsPerCurrency
                        ? `${venue.pointsPerCurrency.toFixed(3)} pts/RSD`
                        : t("receiptScan")}
                    </Text>
                  </View>
                  <View style={s.lightChip}>
                    <Text style={[s.lightChipText, { fontFamily: fonts.bodyBold }]}>
                      {Math.round(venue.distanceMeters)}m
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
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    letterSpacing: 1.8,
  },
  title: { color: "#FFFFFF", fontSize: 38, lineHeight: 42 },
  citySwitch: { gap: 8, alignItems: "flex-end" },
  locationPill: { minHeight: 38, borderRadius: 99, paddingHorizontal: 14, justifyContent: "center" },
  locationPillActive: { backgroundColor: "rgba(255,255,255,0.32)" },
  locationPillIdle: { backgroundColor: "rgba(255,255,255,0.82)" },
  locationText: { fontSize: 12 },
  filters: { gap: 8, paddingBottom: 14 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: colors.lavaBase },
  filterChipIdle: { backgroundColor: "#FFFFFF" },
  filterText: { fontSize: 11 },
  list: { gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 12 },
  row: { flexDirection: "row", gap: 12 },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
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
  chips: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  darkChip: {
    backgroundColor: colors.lavaBase,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkChipText: { color: "#FFFFFF", fontSize: 10 },
  lightChip: {
    backgroundColor: "#EEF3FB",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lightChipText: { color: colors.ink, fontSize: 10 },
  empty: { textAlign: "center", marginTop: 24 },
})
