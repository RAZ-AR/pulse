import { useState } from "react"
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { trpc } from "../lib/trpc"
import { fonts, useTheme } from "../lib/theme"
import { resolveCity, CITY_OPTIONS } from "../lib/venues"
import MapScreen from "./MapScreen"

const ORANGE = "#f2a66e"

type Cat = "CAFE" | "RESTAURANT" | "BEAUTY" | "FITNESS" | "YOGA" | "RETAIL"
const CATS: { key: Cat; label: string }[] = [
  { key: "CAFE", label: "Кафе" },
  { key: "RESTAURANT", label: "Рестораны" },
  { key: "BEAUTY", label: "Красота" },
  { key: "FITNESS", label: "Фитнес" },
  { key: "YOGA", label: "Йога" },
  { key: "RETAIL", label: "Магазины" },
]

export default function PlacesScreen() {
  const theme = useTheme()
  const me = trpc.user.me.useQuery()
  const city = resolveCity(me.data?.homeCity)

  const [view, setView] = useState<"list" | "map">("list")
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<Cat | null>(null)
  const [partnerOnly, setPartnerOnly] = useState(false)
  const [hasOffer, setHasOffer] = useState(false)

  const q = trpc.venue.discover.useInfiniteQuery(
    {
      city: city.name,
      lat: city.lat,
      lng: city.lng,
      ...(query.trim() ? { query: query.trim() } : {}),
      ...(cat ? { categories: [cat] } : {}),
      ...(partnerOnly ? { partnerOnly: true } : {}),
      ...(hasOffer ? { hasOffer: true } : {}),
      sort: "partner",
      limit: 20,
    },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  )
  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  if (view === "map") {
    return (
      <View style={{ flex: 1 }}>
        <MapScreen />
        <Pressable style={[s.viewToggle, { bottom: 90 }]} onPress={() => setView("list")}>
          <Text style={[s.viewToggleText, { fontFamily: fonts.bodyBold }]}>☰  Список</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Места</Text>
        <Text style={[s.sub, { color: theme.textSecondary }]}>{city.label} · {CITY_OPTIONS.length} городов</Text>

        <View style={[s.search, { borderColor: theme.border }]}>
          <Text style={{ color: theme.textMuted }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск места"
            placeholderTextColor={theme.textMuted}
            style={[s.searchInput, { color: theme.text, fontFamily: fonts.body }]}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATS}
          keyExtractor={(c) => c.key}
          contentContainerStyle={s.chipsRow}
          renderItem={({ item }) => {
            const on = cat === item.key
            return (
              <Pressable onPress={() => setCat(on ? null : item.key)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, { fontFamily: fonts.bodyBold, color: on ? "#fff" : theme.textSecondary }]}>{item.label}</Text>
              </Pressable>
            )
          }}
        />

        <View style={s.filterRow}>
          <Pressable onPress={() => setPartnerOnly((v) => !v)} style={[s.fchip, partnerOnly && s.fchipOn]}>
            <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: partnerOnly ? ORANGE : theme.textSecondary }]}>⭐ Партнёры</Text>
          </Pressable>
          <Pressable onPress={() => setHasOffer((v) => !v)} style={[s.fchip, hasOffer && s.fchipOn]}>
            <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: hasOffer ? ORANGE : theme.textSecondary }]}>🎁 Со спецпредложением</Text>
          </Pressable>
          <Pressable onPress={() => setView("map")} style={s.fchip}>
            <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: theme.textSecondary }]}>🗺 Карта</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(v) => v.id}
        contentContainerStyle={s.list}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage() }}
        ListEmptyComponent={
          q.isLoading
            ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 40 }} />
            : <Text style={[s.empty, { color: theme.textMuted }]}>Ничего не нашлось</Text>
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.textSecondary} style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => <VenueCard v={item} theme={theme} />}
      />
    </View>
  )
}

function VenueCard({ v, theme }: { v: any; theme: ReturnType<typeof useTheme> }) {
  const km = v.distanceMeters != null ? (v.distanceMeters / 1000).toFixed(1) + " км" : null
  const rating = v.googleRating ? v.googleRating.toFixed(1) : null
  return (
    <View style={[s.card, theme.shadowRaisedSm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.cardIcon, { backgroundColor: theme.bgLight }]}>
        <Text style={[s.cardIconText, { fontFamily: fonts.displayHeavy, color: theme.textSecondary }]}>{(v.name || "?").slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardName, { color: theme.text, fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{v.name}</Text>
        <Text style={[s.cardMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {catLabel(v.category)}{km ? ` · ${km}` : ""}{rating ? ` · ★ ${rating}` : ""}
        </Text>
        <Text style={[s.cardAddr, { color: theme.textMuted }]} numberOfLines={1}>{v.address}</Text>
        <View style={s.badges}>
          {v.isPartner ? <Badge text="⭐ Партнёр" /> : null}
          {v.hasOffer ? <Badge text="🎁 Оффер" /> : null}
          {v.pointsPerCurrency ? <Badge text={`💰 ${v.pointsPerCurrency}×`} /> : null}
        </View>
      </View>
    </View>
  )
}

function Badge({ text }: { text: string }) {
  return (
    <View style={s.badge}>
      <Text style={[s.badgeText, { fontFamily: fonts.bodyBold }]}>{text}</Text>
    </View>
  )
}

function catLabel(c: string) {
  return { CAFE: "Кафе", RESTAURANT: "Ресторан", BEAUTY: "Красота", FITNESS: "Фитнес", YOGA: "Йога", RETAIL: "Магазин", SERVICE: "Услуги", OTHER: "Другое" }[c] ?? c
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: Platform.OS === "web" ? 18 : 54, paddingHorizontal: 18, paddingBottom: 6 },
  title: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, height: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  chipsRow: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
  chipOn: { backgroundColor: ORANGE },
  chipText: { fontSize: 13 },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  fchip: { paddingHorizontal: 12, height: 32, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
  fchipOn: { backgroundColor: "#FBEADC" },
  fchipText: { fontSize: 12 },
  list: { padding: 16, paddingBottom: 110, gap: 12 },
  card: { flexDirection: "row", gap: 12, borderRadius: 22, padding: 14, borderWidth: 1, borderBottomWidth: 4 },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardIconText: { fontSize: 18 },
  cardName: { fontSize: 16 },
  cardMeta: { fontSize: 13, marginTop: 2 },
  cardAddr: { fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 },
  badge: { backgroundColor: "#FBEADC", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: "#B5651D" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  viewToggle: { position: "absolute", alignSelf: "center", backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 20, paddingVertical: 12, shadowColor: "#9A958A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  viewToggleText: { fontSize: 14, color: "#33322D" },
})
