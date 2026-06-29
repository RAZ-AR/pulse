import { useState } from "react"
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { fonts, useTheme } from "../lib/theme"
import { resolveCity, CITY_OPTIONS } from "../lib/venues"
import { GadgetCard, LcdPanel, LcdText, ModeHeader } from "../components/gadget"
import MapScreen from "./MapScreen"

const ORANGE = "#fd4600"

type Cat = "CAFE" | "RESTAURANT" | "BEAUTY" | "FITNESS" | "YOGA" | "RETAIL" | "SERVICE" | "OTHER"
type Sort = "distance" | "rating" | "rate"

const CATS: { key: Cat; label: string; emoji: string }[] = [
  { key: "CAFE", label: "Кафе", emoji: "☕" },
  { key: "RESTAURANT", label: "Рестораны", emoji: "🍽" },
  { key: "RETAIL", label: "Магазины", emoji: "🛍" },
  { key: "BEAUTY", label: "Красота", emoji: "💄" },
  { key: "FITNESS", label: "Фитнес", emoji: "💪" },
  { key: "YOGA", label: "Йога", emoji: "🧘" },
  { key: "SERVICE", label: "Услуги", emoji: "⚙️" },
  { key: "OTHER", label: "Другое", emoji: "📍" },
]

const SORTS: { key: Sort; label: string }[] = [
  { key: "distance", label: "Рядом" },
  { key: "rating", label: "Рейтинг" },
  { key: "rate", label: "Баллы" },
]

function catEmoji(c: string) {
  return CATS.find((x) => x.key === c)?.emoji ?? "📍"
}

function catLabel(c: string) {
  return CATS.find((x) => x.key === c)?.label ?? c
}

export default function PlacesScreen() {
  const theme = useTheme()
  const router = useRouter()
  const me = trpc.user.me.useQuery()
  const city = resolveCity(me.data?.homeCity)

  const [view, setView] = useState<"list" | "map">("list")
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<Cat | null>(null)
  const [partnerOnly, setPartnerOnly] = useState(false)
  const [hasOffer, setHasOffer] = useState(false)
  const [sort, setSort] = useState<Sort>("distance")

  const q = trpc.venue.discover.useInfiniteQuery(
    {
      city: city.name,
      lat: city.lat,
      lng: city.lng,
      radiusKm: city.radiusKm,
      sort,
      limit: 30,
      ...(query.trim() ? { query: query.trim() } : {}),
      ...(cat ? { categories: [cat] } : {}),
      ...(partnerOnly ? { partnerOnly: true } : {}),
      ...(hasOffer ? { hasOffer: true } : {}),
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

  const Header = (
    <View style={s.header}>
      <ModeHeader kicker="PLACES" title="Места" onFace={() => router.push("/" as Parameters<typeof router.push>[0])} />
      <LcdPanel>
        <LcdText>▸ {city.label.toUpperCase()} · {items.length} МЕСТ</LcdText>
      </LcdPanel>

      <View style={[s.search, { borderColor: theme.border }]}>
        <Text style={{ color: theme.textMuted }}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Кафе, рестораны, магазины…"
          placeholderTextColor={theme.textMuted}
          style={[s.searchInput, { color: theme.text, fontFamily: fonts.body }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Text style={{ color: theme.textMuted, fontSize: 16 }}>×</Text>
          </Pressable>
        )}
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
              <Text style={[s.chipText, { fontFamily: fonts.pixel, color: on ? "#fff" : "#75736A" }]} numberOfLines={1}>
                {item.emoji} {item.label.toUpperCase()}
              </Text>
            </Pressable>
          )
        }}
      />

      <View style={s.filterRow}>
        <Pressable onPress={() => setPartnerOnly((v) => !v)} style={[s.fchip, partnerOnly && s.fchipOn]}>
          <Text style={[s.fchipText, { fontFamily: fonts.pixel, color: partnerOnly ? ORANGE : "#75736A" }]}>⭐ ПАРТНЁРЫ</Text>
        </Pressable>
        <Pressable onPress={() => setHasOffer((v) => !v)} style={[s.fchip, hasOffer && s.fchipOn]}>
          <Text style={[s.fchipText, { fontFamily: fonts.pixel, color: hasOffer ? ORANGE : "#75736A" }]}>🎁 АКЦИИ</Text>
        </Pressable>
        <Pressable onPress={() => setView("map")} style={s.fchip}>
          <Text style={[s.fchipText, { fontFamily: fonts.pixel, color: "#75736A" }]}>🗺 КАРТА</Text>
        </Pressable>
      </View>

      <View style={s.sortRow}>
        <Text style={[s.sortLabel, { color: theme.textMuted, fontFamily: fonts.pixel }]}>СОРТИРОВКА</Text>
        {SORTS.map((opt) => {
          const on = sort === opt.key
          return (
            <Pressable key={opt.key} onPress={() => setSort(opt.key)} style={[s.sortChip, on && s.sortChipOn]}>
              <Text style={[s.sortChipText, { fontFamily: fonts.pixel, color: on ? "#fff" : "#75736A" }]}>
                {opt.label.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={Header}
        contentContainerStyle={s.list}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage() }}
        ListEmptyComponent={
          q.isLoading
            ? <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 40 }} />
            : <Text style={[s.empty, { color: theme.textMuted }]}>Ничего не нашлось</Text>
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.textSecondary} style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => {
          const km = item.distanceMeters != null ? `${(item.distanceMeters / 1000).toFixed(1)} КМ` : null
          const rating = item.googleRating ? `★ ${item.googleRating.toFixed(1)}` : null
          const meta = [catLabel(item.category).toUpperCase(), km, rating].filter(Boolean).join(" · ")
          const chips = [
            ...(item.isPartner ? ["⭐ ПАРТНЁР"] : []),
            ...(item.hasOffer ? ["🎁 АКЦИЯ"] : []),
            ...(item.pointsPerCurrency ? [`${item.pointsPerCurrency}× БАЛЛЫ`] : []),
          ]
          return (
            <GadgetCard
              icon={catEmoji(item.category)}
              name={item.name}
              meta={meta}
              address={item.address}
              chips={chips}
              onPress={() => router.push(`/venue/${item.id}` as Parameters<typeof router.push>[0])}
            />
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: Platform.OS === "web" ? 18 : 54, paddingHorizontal: 18, paddingBottom: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, height: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", borderBottomWidth: 3, borderBottomColor: "rgba(110,102,86,0.18)" },
  searchInput: { flex: 1, fontSize: 15 },
  chipsRow: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", borderBottomWidth: 3, borderBottomColor: "rgba(110,102,86,0.18)" },
  chipOn: { backgroundColor: ORANGE, borderBottomColor: "#c83700" },
  chipText: { fontSize: 11, letterSpacing: 0.5 },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  fchip: { paddingHorizontal: 12, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", borderBottomWidth: 3, borderBottomColor: "rgba(110,102,86,0.18)" },
  fchipOn: { backgroundColor: "#FBEADC", borderBottomColor: "rgba(180,120,70,0.4)" },
  fchipText: { fontSize: 10, letterSpacing: 0.5 },

  sortRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sortLabel: { fontSize: 9, letterSpacing: 0.5, marginRight: 2 },
  sortChip: { paddingHorizontal: 12, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", borderBottomWidth: 3, borderBottomColor: "rgba(110,102,86,0.18)" },
  sortChipOn: { backgroundColor: "#015634", borderBottomColor: "#013d24" },
  sortChipText: { fontSize: 10, letterSpacing: 0.5 },

  list: { padding: 16, paddingBottom: 110, gap: 12 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  viewToggle: { position: "absolute", alignSelf: "center", backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 20, paddingVertical: 12, shadowColor: "#9A958A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  viewToggleText: { fontSize: 14, color: "#015634" },
})
