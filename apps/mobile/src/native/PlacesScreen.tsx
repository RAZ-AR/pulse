import { useState } from "react"
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { trpc } from "../lib/trpc"
import { fonts, useTheme } from "../lib/theme"
import { resolveCity, CITY_OPTIONS } from "../lib/venues"
import MapScreen from "./MapScreen"

const ORANGE = "#fd4600"

type Cat = "CAFE" | "RESTAURANT" | "BEAUTY" | "FITNESS" | "YOGA" | "RETAIL" | "SERVICE" | "OTHER"

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

  const sectionMode = !cat && !query.trim() && !partnerOnly && !hasOffer

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
      limit: sectionMode ? 60 : 20,
    },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  )
  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  // Build sections for section mode
  const sections = sectionMode
    ? CATS.map((c) => ({ ...c, items: items.filter((v) => v.category === c.key) })).filter((s) => s.items.length > 0)
    : []

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
      <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Места</Text>
      <Text style={[s.sub, { color: theme.textSecondary }]}>{city.label} · {CITY_OPTIONS.length} города</Text>

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
              <Text style={[s.chipText, { fontFamily: fonts.bodyBold, color: on ? "#fff" : theme.textSecondary }]}>
                {item.emoji} {item.label}
              </Text>
            </Pressable>
          )
        }}
      />

      <View style={s.filterRow}>
        <Pressable onPress={() => setPartnerOnly((v) => !v)} style={[s.fchip, partnerOnly && s.fchipOn]}>
          <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: partnerOnly ? ORANGE : theme.textSecondary }]}>⭐ Партнёры</Text>
        </Pressable>
        <Pressable onPress={() => setHasOffer((v) => !v)} style={[s.fchip, hasOffer && s.fchipOn]}>
          <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: hasOffer ? ORANGE : theme.textSecondary }]}>🎁 Акции</Text>
        </Pressable>
        <Pressable onPress={() => setView("map")} style={s.fchip}>
          <Text style={[s.fchipText, { fontFamily: fonts.bodyBold, color: theme.textSecondary }]}>🗺 Карта</Text>
        </Pressable>
      </View>
    </View>
  )

  if (q.isLoading) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        {Header}
        <ActivityIndicator color={theme.textSecondary} style={{ marginTop: 40 }} />
      </View>
    )
  }

  // Section mode: grouped horizontal rows
  if (sectionMode && sections.length > 0) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {Header}
          {sections.map((section) => (
            <View key={section.key} style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                  {section.emoji} {section.label}
                </Text>
                <Pressable onPress={() => setCat(section.key)}>
                  <Text style={[s.sectionMore, { color: ORANGE, fontFamily: fonts.bodyBold }]}>Все →</Text>
                </Pressable>
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={section.items}
                keyExtractor={(v) => v.id}
                contentContainerStyle={s.horizontalList}
                renderItem={({ item }) => (
                  <Pressable
                    style={{ width: 220 }}
                    onPress={() => router.push(`/venue/${item.id}` as Parameters<typeof router.push>[0])}
                  >
                    <VenueCardHorizontal v={item} theme={theme} />
                  </Pressable>
                )}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  // Filter mode: vertical list
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
          <Text style={[s.empty, { color: theme.textMuted }]}>Ничего не нашлось</Text>
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.textSecondary} style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/venue/${item.id}` as Parameters<typeof router.push>[0])}>
            <VenueCard v={item} theme={theme} />
          </Pressable>
        )}
      />
    </View>
  )
}

function VenueCardHorizontal({ v, theme }: { v: any; theme: ReturnType<typeof useTheme> }) {
  const rating = v.googleRating ? v.googleRating.toFixed(1) : null
  const km = v.distanceMeters != null ? (v.distanceMeters / 1000).toFixed(1) + " км" : null
  return (
    <View style={[s.hcard, theme.shadowRaisedSm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.hcardIcon, { backgroundColor: theme.bgLight }]}>
        <Text style={{ fontSize: 22 }}>{catEmoji(v.category)}</Text>
      </View>
      <Text style={[s.hcardName, { color: theme.text, fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{v.name}</Text>
      <Text style={[s.hcardAddr, { color: theme.textMuted }]} numberOfLines={1}>{v.address}</Text>
      <View style={s.hcardMeta}>
        {rating ? <Text style={[s.hcardRating, { color: theme.textSecondary }]}>★ {rating}</Text> : null}
        {km ? <Text style={[s.hcardDist, { color: theme.textMuted }]}>{km}</Text> : null}
      </View>
      <View style={s.badges}>
        {v.isPartner ? <Badge text="⭐ Партнёр" /> : null}
        {v.hasOffer ? <Badge text="🎁 Акция" /> : null}
      </View>
    </View>
  )
}

function VenueCard({ v, theme }: { v: any; theme: ReturnType<typeof useTheme> }) {
  const km = v.distanceMeters != null ? (v.distanceMeters / 1000).toFixed(1) + " км" : null
  const rating = v.googleRating ? v.googleRating.toFixed(1) : null
  return (
    <View style={[s.card, theme.shadowRaisedSm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.cardIcon, { backgroundColor: theme.bgLight }]}>
        <Text style={{ fontSize: 20 }}>{catEmoji(v.category)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardName, { color: theme.text, fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{v.name}</Text>
        <Text style={[s.cardMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {catLabel(v.category)}{km ? ` · ${km}` : ""}{rating ? ` · ★ ${rating}` : ""}
        </Text>
        <Text style={[s.cardAddr, { color: theme.textMuted }]} numberOfLines={1}>{v.address}</Text>
        <View style={s.badges}>
          {v.isPartner ? <Badge text="⭐ Партнёр" /> : null}
          {v.hasOffer ? <Badge text="🎁 Акция" /> : null}
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

  // Section mode
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, marginBottom: 10, marginTop: 6 },
  sectionTitle: { fontSize: 20 },
  sectionMore: { fontSize: 13 },
  horizontalList: { paddingHorizontal: 18, gap: 12 },
  hcard: { borderRadius: 20, padding: 14, borderWidth: 1, borderBottomWidth: 3 },
  hcardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  hcardName: { fontSize: 15, marginBottom: 2 },
  hcardAddr: { fontSize: 11, marginBottom: 6 },
  hcardMeta: { flexDirection: "row", gap: 8 },
  hcardRating: { fontSize: 12 },
  hcardDist: { fontSize: 12 },

  // List mode
  list: { padding: 16, paddingBottom: 110, gap: 12 },
  card: { flexDirection: "row", gap: 12, borderRadius: 22, padding: 14, borderWidth: 1, borderBottomWidth: 4 },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 16 },
  cardMeta: { fontSize: 13, marginTop: 2 },
  cardAddr: { fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 },
  badge: { backgroundColor: "#FBEADC", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: "#B5651D" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
  viewToggle: { position: "absolute", alignSelf: "center", backgroundColor: "#fff", borderRadius: 99, paddingHorizontal: 20, paddingVertical: 12, shadowColor: "#9A958A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  viewToggleText: { fontSize: 14, color: "#015634" },
})
