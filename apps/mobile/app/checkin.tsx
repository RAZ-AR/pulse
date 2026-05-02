import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter, Stack } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Location from "expo-location"
import { trpc } from "../src/lib/trpc"
import { uploadCheckinImage } from "../src/lib/storage"
import { colors, useTheme } from "../src/lib/theme"

type Coords = { lat: number; lng: number; accuracy: number }
type NearbyVenue = {
  id: string
  name: string
  category: string
  distanceMeters: number
}
type Phase =
  | { kind: "locating" }
  | { kind: "noLocation"; reason: string }
  | { kind: "pickingVenue"; coords: Coords }
  | { kind: "noVenuesNearby"; coords: Coords }
  | { kind: "camera"; coords: Coords; venue: NearbyVenue }
  | { kind: "uploading"; coords: Coords; venue: NearbyVenue }
  | { kind: "submitting"; coords: Coords; venue: NearbyVenue }
  | { kind: "done"; pointsEarned: number; streakBonus: number; newStreak: number; venue: NearbyVenue }

const NEARBY_RADIUS_KM = 0.1 // 100m matches CHECKIN_RADIUS_METERS on backend

export default function CheckinScreen() {
  const theme = useTheme()
  const { t } = useTranslation("checkin")
  const router = useRouter()
  const utils = trpc.useUtils()

  const me = trpc.user.me.useQuery()
  const userId = me.data?.id

  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "locating" })

  const createCheckin = trpc.checkin.create.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
    },
  })

  // Acquire location once on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== "granted") {
          if (!cancelled) setPhase({ kind: "noLocation", reason: t("permissionDenied", "Location permission denied") })
          return
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
        if (cancelled) return
        const coords: Coords = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 999,
        }
        setPhase({ kind: "pickingVenue", coords })
      } catch (e) {
        if (!cancelled) setPhase({ kind: "noLocation", reason: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => { cancelled = true }
  }, [t])

  // ── Render by phase ───────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("title", "Check in"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {phase.kind === "locating" ? (
          <Centered>
            <ActivityIndicator size="large" color={colors.sky} />
            <Text style={[s.label, { color: theme.textSecondary }]}>{t("locating", "Finding your location…")}</Text>
          </Centered>
        ) : phase.kind === "noLocation" ? (
          <Centered>
            <Text style={s.bigEmoji}>📍</Text>
            <Text style={[s.title, { color: theme.text }]}>{t("locationNeeded", "Location needed")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>{phase.reason}</Text>
            <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: theme.text }]}>
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("common:back", "Go back")}</Text>
            </Pressable>
          </Centered>
        ) : phase.kind === "pickingVenue" ? (
          <VenuePicker
            coords={phase.coords}
            onPick={(venue) => setPhase({ kind: "camera", coords: phase.coords, venue })}
            onNoVenues={() => setPhase({ kind: "noVenuesNearby", coords: phase.coords })}
            theme={theme}
          />
        ) : phase.kind === "noVenuesNearby" ? (
          <Centered>
            <Text style={s.bigEmoji}>🤔</Text>
            <Text style={[s.title, { color: theme.text }]}>{t("noVenuesNearby", "No venues nearby")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>
              {t("noVenuesNearbyDesc", "Move closer to a partner venue and try again. Check-ins require being within 100m of a venue.")}
            </Text>
            <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: theme.text }]}>
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("common:done", "OK")}</Text>
            </Pressable>
          </Centered>
        ) : phase.kind === "camera" ? (
          <CameraPhase
            permission={permission}
            requestPermission={requestPermission}
            cameraRef={cameraRef}
            venue={phase.venue}
            theme={theme}
            onCapture={async () => {
              if (!cameraRef.current || !userId) return
              try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
                if (!photo?.uri) throw new Error("No photo URI")

                setPhase({ kind: "uploading", coords: phase.coords, venue: phase.venue })
                const photoUrl = await uploadCheckinImage(photo.uri, userId)

                setPhase({ kind: "submitting", coords: phase.coords, venue: phase.venue })
                const result = await createCheckin.mutateAsync({
                  venueId: phase.venue.id,
                  photoUrl,
                  lat: phase.coords.lat,
                  lng: phase.coords.lng,
                  accuracyMeters: phase.coords.accuracy,
                })
                setPhase({
                  kind: "done",
                  pointsEarned: result.pointsEarned,
                  streakBonus: result.streakBonus,
                  newStreak: result.newStreak,
                  venue: phase.venue,
                })
              } catch (e) {
                Alert.alert(
                  t("checkinFailed", "Check-in failed"),
                  e instanceof Error ? e.message : String(e),
                )
                setPhase({ kind: "camera", coords: phase.coords, venue: phase.venue })
              }
            }}
            onBack={() => setPhase({ kind: "pickingVenue", coords: phase.coords })}
          />
        ) : phase.kind === "uploading" || phase.kind === "submitting" ? (
          <Centered>
            <ActivityIndicator size="large" color={colors.sky} />
            <Text style={[s.label, { color: theme.textSecondary }]}>
              {phase.kind === "uploading" ? t("uploading", "Uploading photo…") : t("verifying", "Verifying check-in…")}
            </Text>
          </Centered>
        ) : (
          <Centered>
            <Text style={s.bigEmoji}>✓</Text>
            <Text style={[s.title, { color: theme.text }]}>{t("success", "Checked in!")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>{phase.venue.name}</Text>
            <Text style={[s.points, { color: colors.mint }]}>+{phase.pointsEarned} pts</Text>
            {phase.streakBonus > 0 ? (
              <Text style={[s.streakBonus, { color: colors.pink }]}>
                +{phase.streakBonus} {t("streakBonus", "streak bonus")}
              </Text>
            ) : null}
            <Text style={[s.streakInfo, { color: theme.textSecondary }]}>
              🔥 {phase.newStreak} {t("dayStreak", "day streak")}
            </Text>
            <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: theme.text, marginTop: 24 }]}>
              <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("common:done", "Done")}</Text>
            </Pressable>
          </Centered>
        )}
      </View>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={s.centered}>{children}</View>
}

function VenuePicker({
  coords, onPick, onNoVenues, theme,
}: {
  coords: Coords
  onPick: (venue: NearbyVenue) => void
  onNoVenues: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation("checkin")
  const venues = trpc.venue.nearby.useQuery({
    lat: coords.lat,
    lng: coords.lng,
    radiusKm: NEARBY_RADIUS_KM,
    limit: 10,
  })

  // Auto-pick if exactly one venue is nearby
  useEffect(() => {
    if (venues.data && venues.data.length === 1) {
      const v = venues.data[0]!
      onPick({ id: v.id, name: v.name, category: v.category, distanceMeters: v.distanceMeters })
    } else if (venues.data && venues.data.length === 0) {
      onNoVenues()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues.data])

  if (venues.isLoading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.sky} />
        <Text style={[s.label, { color: theme.textSecondary }]}>{t("findingVenues", "Finding venues nearby…")}</Text>
      </Centered>
    )
  }
  if (!venues.data || venues.data.length === 0) {
    return null // handed off to onNoVenues effect above
  }

  return (
    <ScrollView contentContainerStyle={s.pickerContent}>
      <Text style={[s.title, { color: theme.text }]}>{t("pickVenue", "Where are you?")}</Text>
      <Text style={[s.subtitle, { color: theme.textSecondary, marginBottom: 16 }]}>
        {t("pickVenueDesc", "Pick the venue you're at — we'll verify with a photo")}
      </Text>
      {venues.data.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => onPick({ id: v.id, name: v.name, category: v.category, distanceMeters: v.distanceMeters })}
          style={[s.venueCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.venueName, { color: theme.text }]}>{v.name}</Text>
            <Text style={[s.venueSub, { color: theme.textSecondary }]}>
              {v.category.toLowerCase()} · {Math.round(v.distanceMeters)}m {t("away", "away")}
            </Text>
          </View>
          <Text style={[s.venueArrow, { color: theme.textSecondary }]}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function CameraPhase({
  permission, requestPermission, cameraRef, venue, theme, onCapture, onBack,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: ReturnType<typeof useCameraPermissions>[1]
  cameraRef: { current: CameraView | null }
  venue: NearbyVenue
  theme: ReturnType<typeof useTheme>
  onCapture: () => void
  onBack: () => void
}) {
  const { t } = useTranslation("checkin")

  if (!permission) {
    return <Centered><ActivityIndicator color={theme.text} /></Centered>
  }
  if (!permission.granted) {
    return (
      <Centered>
        <Text style={[s.title, { color: theme.text }]}>{t("cameraNeeded", "Camera access needed")}</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>
          {t("cameraNeededDesc", "PULSE needs your camera to verify check-ins.")}
        </Text>
        <Pressable onPress={requestPermission} style={[s.btn, { backgroundColor: theme.text }]}>
          <Text style={{ color: theme.bg, fontWeight: "700" }}>{t("grantAccess", "Grant access")}</Text>
        </Pressable>
      </Centered>
    )
  }
  return (
    <View style={s.cameraWrap}>
      <CameraView ref={cameraRef} style={s.camera} facing="back" />
      <View style={s.cameraOverlay}>
        <View style={[s.venueBanner, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Text style={s.bannerLabel}>{t("checkingInAt", "Checking in at").toUpperCase()}</Text>
          <Text style={s.bannerName}>{venue.name}</Text>
        </View>
        <Text style={s.frameHint}>
          {t("photoHint", "Take a photo of the venue interior or exterior")}
        </Text>
      </View>
      <View style={s.shutterRow}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backBtnText}>×</Text>
        </Pressable>
        <Pressable onPress={onCapture} style={s.shutter}>
          <View style={s.shutterInner} />
        </Pressable>
        <View style={s.backBtn} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  label: { fontSize: 13, marginTop: 14 },
  title: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  bigEmoji: { fontSize: 72 },
  btn: { padding: 14, paddingHorizontal: 28, borderRadius: 12, alignItems: "center", marginTop: 16 },
  pickerContent: { padding: 20, paddingBottom: 40 },
  venueCard: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  venueName: { fontSize: 15, fontWeight: "700" },
  venueSub: { fontSize: 12, marginTop: 2 },
  venueArrow: { fontSize: 18 },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", padding: 24, paddingTop: 24, paddingBottom: 120 },
  venueBanner: { padding: 12, borderRadius: 12, alignSelf: "center" },
  bannerLabel: { color: "#FFF", fontSize: 10, fontWeight: "700", letterSpacing: 1, opacity: 0.8, textAlign: "center" },
  bannerName: { color: "#FFF", fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: 2 },
  frameHint: { color: "#FFF", fontSize: 13, fontWeight: "600", textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  shutterRow: { position: "absolute", bottom: 32, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40 },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.3)", borderWidth: 3, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFF" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  backBtnText: { color: "#FFF", fontSize: 22, fontWeight: "300" },
  points: { fontSize: 36, fontWeight: "800", marginTop: 16 },
  streakBonus: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  streakInfo: { fontSize: 13, marginTop: 12 },
})
