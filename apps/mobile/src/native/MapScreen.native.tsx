import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import * as Location from "expo-location"
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps"
import { trpc } from "../../src/lib/trpc"
import { colors, neonColors, fonts, useTheme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

// Belgrade as default center (until we get user location)
const DEFAULT_REGION: Region = {
  latitude: 44.7866,
  longitude: 20.4489,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export default function MapScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"

  const [activeFilterKey, setActiveFilterKey] = useState("all")
  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [hasLocation, setHasLocation] = useState(false)
  const [denied, setDenied] = useState(false)
  const me = trpc.user.me.useQuery()
  const utils = trpc.useUtils()
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const selectedCity = resolveCity(me.data?.homeCity)
  const activeFilter = VENUE_FILTERS.find((filter) => filter.key === activeFilterKey) ?? DEFAULT_VENUE_FILTER

  useEffect(() => {
    if (hasLocation) return
    setRegion((current) => ({
      ...current,
      latitude: selectedCity.lat,
      longitude: selectedCity.lng,
    }))
  }, [hasLocation, selectedCity.lat, selectedCity.lng])

  // Request location once on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== "granted") {
          if (!cancelled) setDenied(true)
          return
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (cancelled) return
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        })
        setHasLocation(true)
      } catch {
        if (!cancelled) setDenied(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Approximate radius from latitudeDelta (rough — 1 degree ≈ 111 km)
  const radiusKm = Math.min(50, Math.max(0.5, region.latitudeDelta * 111))

  const venues = trpc.venue.nearby.useQuery(
    {
      lat: region.latitude,
      lng: region.longitude,
      radiusKm,
      ...(activeFilter.category ? { category: activeFilter.category } : {}),
      limit: 50,
    },
    { enabled: hasLocation || true }, // also load with default region
  )

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={s.map}
        initialRegion={region}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={hasLocation}
        showsMyLocationButton={false}
      >
        {(venues.data ?? []).map((v) => {
          const isFeatured = v.subscriptionTier === "FEATURED"
          return (
            <Marker
              key={v.id}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              pinColor={isFeatured ? (isRainbow ? neonColors.pink : "#FFB347") : v.isPartner ? (isRainbow ? neonColors.purple : colors.pinkSolid) : (isRainbow ? neonColors.cyan : colors.skySolid)}
              title={isFeatured ? `★ ${v.name}` : v.name}
              description={v.isPartner && v.pointsPerCurrency
                ? `${v.pointsPerCurrency.toFixed(3)} pts/RSD${isFeatured ? " · FEATURED" : ""}`
                : t(`category.${v.category}`, v.category.toLowerCase())}
              onCalloutPress={() => router.push({ pathname: "/venue/[id]", params: { id: v.id } })}
            />
          )
        })}
      </MapView>

      {/* Loading overlay */}
      {venues.isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : null}

      {/* Status badge */}
      <View style={[s.badge, { backgroundColor: isRainbow ? "#F2F2F6" : theme.bg }, theme.shadowRaisedSm]}>
        <Text style={{ color: isRainbow ? neonColors.cyan : theme.text, fontSize: 12, fontFamily: fonts.bodyBold }}>
          {venues.data?.length ?? 0} {t("nearby", "nearby")}
        </Text>
      </View>

      <View style={s.cityBadges}>
        {CITY_OPTIONS.map((city) => {
          const active = selectedCity.name === city.name
          return (
            <Pressable
              key={city.name}
              onPress={() => updateProfile.mutate({ homeCity: city.name })}
              style={[
                s.cityBadge,
                active
                  ? (isRainbow ? s.cityBadgeActiveRainbow : s.cityBadgeActive)
                  : { backgroundColor: isRainbow ? "#F2F2F6" : theme.bg },
                theme.shadowRaisedSm,
              ]}
            >
              <Text style={{ color: active && isRainbow ? neonColors.purple : theme.text, fontSize: 12, fontFamily: fonts.bodyBold }}>
                ⌖ {city.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersWrap} contentContainerStyle={s.filters}>
        {VENUE_FILTERS.map((filter) => {
          const active = filter.key === activeFilterKey
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

      {/* Denied state */}
      {denied ? (
        <View style={[s.deniedCard, { backgroundColor: theme.bg }, theme.shadowRaised]}>
          <Text style={[s.deniedTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("locationDenied", "Location access denied")}
          </Text>
          <Text style={[s.deniedText, { color: theme.textSecondary }]}>
            {t("locationDeniedDesc", `Showing venues in ${selectedCity.label}. Enable location in Settings to find venues near you.`)}
          </Text>
          <Pressable
            onPress={() => setDenied(false)}
            style={[s.dismissBtn, { backgroundColor: "#F9FBFF" }, theme.shadowRaisedSm]}
          >
            <Text style={{ color: theme.text, fontFamily: fonts.bodyBold }}>{t("common:done", "OK")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  loading: { position: "absolute", top: 16, alignSelf: "center", padding: 10, backgroundColor: "rgba(249,251,255,0.86)", borderRadius: 20 },
  badge: { position: "absolute", top: 16, right: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  cityBadges: { position: "absolute", top: 16, left: 16, gap: 8 },
  cityBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  cityBadgeActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  cityBadgeActiveRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 1 },
  filtersWrap: { position: "absolute", left: 16, right: 16, bottom: 26 },
  filters: { gap: 8, paddingRight: 32 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  filterChipActiveRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: "rgba(249,251,255,0.68)" },
  filterText: { fontSize: 11 },
  deniedCard: { position: "absolute", bottom: 24, left: 16, right: 16, padding: 18, borderRadius: 34 },
  deniedTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  deniedText: { fontSize: 12, lineHeight: 16, marginBottom: 12 },
  dismissBtn: { padding: 12, borderRadius: 99, alignItems: "center" },
})
