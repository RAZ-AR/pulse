import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { colors, neonColors, fonts, useTheme } from "../lib/theme"
import { LavaLampSurface, VolumeGradient } from "../components/neu"
import { useColorMode } from "../store/colorMode"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../lib/venues"

// --- MapLibre GL (web only) ---------------------------------------------
// Loaded from CDN so there's no npm dependency or bundler config. Free OSM
// raster tiles by default; drop a free MapTiler key below for vector tiles.
const MAPTILER_KEY = "" // https://cloud.maptiler.com → free key → prettier map
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : (OSM_STYLE as unknown as string)

const MAPLIBRE_VER = "4.7.1"
let mapLibrePromise: Promise<any> | null = null
function loadMapLibre(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  const w = window as any
  if (w.maplibregl) return Promise.resolve(w.maplibregl)
  if (mapLibrePromise) return mapLibrePromise
  mapLibrePromise = new Promise((resolve, reject) => {
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`
    document.head.appendChild(css)
    const js = document.createElement("script")
    js.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`
    js.onload = () => resolve(w.maplibregl)
    js.onerror = () => reject(new Error("maplibre failed to load"))
    document.head.appendChild(js)
  })
  return mapLibrePromise
}

type MapVenue = { id: string; name: string; lat: number; lng: number; isPartner: boolean }

function LiveMap({
  venues,
  center,
  onPick,
}: {
  venues: MapVenue[]
  center: { lat: number; lng: number }
  onPick: (id: string) => void
}) {
  const hostRef = useRef<any>(null)
  const mapRef = useRef<any>(null)
  const glRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  // Init the map once.
  useEffect(() => {
    let cancelled = false
    loadMapLibre()
      .then((gl) => {
        if (cancelled || !hostRef.current || mapRef.current) return
        glRef.current = gl
        const map = new gl.Map({
          container: hostRef.current,
          style: MAP_STYLE,
          center: [center.lng, center.lat],
          zoom: 12,
        })
        map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right")
        map.addControl(
          new gl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
          }),
          "top-right",
        )
        mapRef.current = map
      })
      .catch(() => {})
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recenter when the chosen city changes.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: 12 })
  }, [center.lat, center.lng])

  // Sync markers whenever the venue list changes.
  useEffect(() => {
    const gl = glRef.current
    const map = mapRef.current
    if (!gl || !map) return
    let raf = 0
    const draw = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = venues
        .filter((v) => typeof v.lat === "number" && typeof v.lng === "number")
        .map((v) => {
          const marker = new gl.Marker({ color: v.isPartner ? "#E5392A" : "#015634" })
            .setLngLat([v.lng, v.lat])
            .addTo(map)
          const el = marker.getElement()
          el.style.cursor = "pointer"
          el.title = v.name
          el.addEventListener("click", () => pickRef.current(v.id))
          return marker
        })
    }
    if (map.loaded()) draw()
    else map.once("load", () => { raf = requestAnimationFrame(draw) })
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [venues])

  return <View ref={hostRef} style={s.mapLive} />
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
  const openVenue = useCallback(
    (id: string) => router.push({ pathname: "/venue/[id]", params: { id } }),
    [router],
  )

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
        <LiveMap
          venues={visibleVenues}
          center={{ lat: selectedCity.lat, lng: selectedCity.lng }}
          onPick={openVenue}
        />
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
    color: "#A5A299",
    fontSize: 11,
    letterSpacing: 1.8,
  },
  title: { color: "#015634", fontSize: 38, lineHeight: 42 },
  citySwitch: { gap: 8, alignItems: "flex-end" },
  locationPill: { minHeight: 38, borderRadius: 99, paddingHorizontal: 14, justifyContent: "center" },
  locationPillActive: { backgroundColor: "#FFFFFF", shadowColor: "#C9C4B4", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  locationPillIdle: { backgroundColor: "rgba(255,255,255,0.82)" },
  locationText: { fontSize: 12 },
  filters: { gap: 8, paddingBottom: 14 },
  filterChip: { borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipInner: { paddingHorizontal: 0, paddingVertical: 0, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#C9C4B4", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 1 },
  filterChipActiveRainbow: { backgroundColor: "#F2F2F6", shadowColor: "#8B3DFF", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 1 },
  filterChipIdle: { backgroundColor: "rgba(249,251,255,0.62)" },
  filterText: { fontSize: 11 },
  list: { gap: 12 },
  mapPanel: {
    height: 300,
    borderRadius: 40,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "#EEF1F4",
  },
  mapLive: { flex: 1, width: "100%", height: "100%" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 34, padding: 12, shadowColor: "#C9C4B4", shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 2 },
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
  description: { color: "#75736A", fontSize: 12, lineHeight: 16, marginTop: 8 },
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
