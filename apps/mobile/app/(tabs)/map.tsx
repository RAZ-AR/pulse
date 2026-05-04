import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import * as Location from "expo-location"
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../src/lib/theme"

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

  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [hasLocation, setHasLocation] = useState(false)
  const [denied, setDenied] = useState(false)

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
              pinColor={isFeatured ? "#FFB347" : v.isPartner ? colors.pinkSolid : colors.skySolid}
              title={isFeatured ? `★ ${v.name}` : v.name}
              description={v.isPartner && v.pointsPerCurrency
                ? `${v.pointsPerCurrency.toFixed(3)} pts/RSD${isFeatured ? " · FEATURED" : ""}`
                : v.category.toLowerCase()}
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
      <View style={[s.badge, { backgroundColor: theme.bg }, theme.shadowRaisedSm]}>
        <Text style={{ color: theme.text, fontSize: 12, fontFamily: fonts.bodyBold }}>
          {venues.data?.length ?? 0} {t("nearby", "nearby")}
        </Text>
      </View>

      {/* Denied state */}
      {denied ? (
        <View style={[s.deniedCard, { backgroundColor: theme.bg }, theme.shadowRaised]}>
          <Text style={[s.deniedTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("locationDenied", "Location access denied")}
          </Text>
          <Text style={[s.deniedText, { color: theme.textSecondary }]}>
            {t("locationDeniedDesc", "Showing venues in Belgrade. Enable location in Settings to find venues near you.")}
          </Text>
          <Pressable
            onPress={() => setDenied(false)}
            style={[s.dismissBtn, { backgroundColor: theme.text }]}
          >
            <Text style={{ color: theme.bg, fontFamily: fonts.bodyBold }}>{t("common:done", "OK")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  loading: { position: "absolute", top: 16, alignSelf: "center", padding: 10, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 20 },
  badge: { position: "absolute", top: 16, right: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  deniedCard: { position: "absolute", bottom: 24, left: 16, right: 16, padding: 18, borderRadius: 22 },
  deniedTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  deniedText: { fontSize: 12, lineHeight: 16, marginBottom: 12 },
  dismissBtn: { padding: 10, borderRadius: 8, alignItems: "center" },
})
