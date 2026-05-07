import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { colors, fonts, useTheme } from "../lib/theme"
import { LavaLampSurface } from "../components/neu"

export default function MapWebScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()

  const venues = trpc.venue.nearby.useQuery({
    lat: 44.7866,
    lng: 20.4489,
    radiusKm: 50,
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
        <View style={s.locationPill}>
          <Text style={[s.locationText, { fontFamily: fonts.bodyBold }]}>
            {t("belgrade")}
          </Text>
        </View>
      </LavaLampSurface>

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
  locationPill: {
    height: 40,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 99,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  locationText: { color: "#FFFFFF", fontSize: 12 },
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
