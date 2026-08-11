import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { Matrix, PixIcon, cellFor } from "../../src/components/Matrix"
import { trpc } from "../../src/lib/trpc"
import { fonts, pts, radius } from "../../src/lib/theme"
import {
  creatureRaster,
  digits,
  evolutionOf,
  heroRows,
  iconForCategory,
  type CreatureState,
} from "../../src/lib/raster"
import { CITY_OPTIONS, DEFAULT_VENUE_FILTER, getDemoVenues, resolveCity, VENUE_FILTERS } from "../../src/lib/venues"

// Поле главной: 24 колонки, зазор 3, всё поле вписано в ширину контента.
// 21 строка = пустая + 7 цифр + 3 пустых + 8 питомца + 2 запаса.
const HERO_COLS = 24
const HERO_ROWS = 21
const HERO_GAP = 3
const PAD = 18
const MAX_W = 460

function daysLeft(d: Date | string | null | undefined): number {
  if (!d) return 0
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000))
}

/** Чистая функция: отдаёт ключ и число, переводит уже вызывающий. */
function distanceKey(meters: number | null | undefined): { key: string; n: string } | null {
  if (meters === null || meters === undefined) return null
  if (meters < 1000) return { key: "metersShort", n: String(Math.round(meters)) }
  return { key: "kmShort", n: (meters / 1000).toFixed(1) }
}

/** Состояние питомца выводится из активности, отдельного поля в базе не нужно. */
function petState(streak: number): CreatureState {
  const hour = new Date().getHours()
  if (hour < 8) return "asleep"
  if (streak === 0) return "bored"
  return streak >= 3 ? "fed" : "awake"
}

export default function HomeScreen() {
  const router = useRouter()
  const { t } = useTranslation(["common", "venue"])
  const { width } = useWindowDimensions()
  const [activeFilterKey, setActiveFilterKey] = useState("all")

  const me = trpc.user.me.useQuery()
  const utils = trpc.useUtils()
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const selectedCity = resolveCity(me.data?.homeCity)
  const activeFilter = VENUE_FILTERS.find((f) => f.key === activeFilterKey) ?? DEFAULT_VENUE_FILTER
  const nearby = trpc.venue.nearby.useQuery({
    lat: selectedCity.lat,
    lng: selectedCity.lng,
    radiusKm: selectedCity.radiusKm,
    ...(activeFilter.category ? { category: activeFilter.category } : {}),
    limit: 8,
  })
  const challenges = trpc.challenge.listMine.useQuery()

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const lifetime = Math.max(me.data?.totalEarnedLifetime ?? 0, total + (me.data?.spentPoints ?? 0))
  const streak = me.data?.currentStreak ?? 0
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)
  const questCount = (challenges.data ?? []).filter((uc) => !uc.isCompleted).length
  const venues = nearby.data?.length ? nearby.data : getDemoVenues(selectedCity.name, activeFilter)
  const bestRate = venues.reduce((max, v) => Math.max(max, v.pointsPerCurrency ?? 0), 0)

  const petName = (id: string) => t(`pet.${id}`)
  const evolution = evolutionOf(lifetime)
  const creature = creatureRaster(evolution.current.id, petState(streak))

  // Число может не поместиться в 24 колонки — тогда поле расширяется под него.
  const value = String(total)
  const cols = Math.max(HERO_COLS, digits(value)[0]?.length ?? HERO_COLS)
  const contentW = Math.min(width, MAX_W) - PAD * 2
  const cell = cellFor(contentW, cols, HERO_GAP)

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.inner}>
        {/* ── Шапка ── */}
        <View style={s.bar}>
          <Text style={s.mark}>ayoo</Text>
          <Text style={s.mono}>PTS–01 · {selectedCity.label.toUpperCase()}</Text>
        </View>
        <View style={s.ruleInk} />

        {/* ── Трёхтоновый стек ── */}
        <View style={s.stack}>
          <Text style={[s.stackLine, s.tone1]}>{t("balance")}</Text>
          <Text style={[s.stackLine, s.tone2]}>{t("points", { count: total })}</Text>
          <Text style={[s.stackLine, s.tone3]}>
            {streak > 0 ? t("streak", { count: streak }) : t("noStreak")}
          </Text>
        </View>

        {/* ── Дисплей: баланс точками + питомец ── */}
        <View style={s.heroCap}>
          <Text style={s.mono}>
            {petName(evolution.current.id).toUpperCase()} · {t("levelShort", { n: evolution.level }).toUpperCase()}
          </Text>
          {evolution.next ? (
            <Text style={[s.mono, s.monoSig]}>
              {evolution.progress} % → {petName(evolution.next.id).toUpperCase()}
            </Text>
          ) : (
            <Text style={[s.mono, s.monoSig]}>{t("topForm").toUpperCase()}</Text>
          )}
        </View>
        <View style={s.hero}>
          <Matrix
            rows={heroRows(value, creature, cols, HERO_ROWS)}
            cell={cell}
            gap={HERO_GAP}
            on={pts.ink}
            off={pts.dotOff}
            shape="dot"
          />
        </View>

        {/* ── Пары «лейбл — значение» ── */}
        <View style={s.pairs}>
          <Pair label={t("bestRateNearby")} value={bestRate ? bestRate.toFixed(3) : "—"} highlight />
          <Pair label={t("partnersNearby")} value={String(venues.length)} />
          <Pair label={t("welcomeBurnsIn")} value={t("daysShort", { n: welcomeDays })} />
          <Pair label={t("activeQuests")} value={String(questCount)} />
        </View>

        {/* ── Клавиши ── */}
        <View style={s.keys}>
          <Key tone="sig" icon="scan" label={t("scanReceipt")} onPress={() => router.push("/scan")} />
          <Key tone="ink" icon="pin" label={t("checkIn")} onPress={() => router.push("/checkin")} />
          <Key tone="pap" icon="gift" label={t("nav.rewards")} onPress={() => router.push("/rewards")} />
          <Key tone="pap" icon="nav" label={t("nav.map")} onPress={() => router.push("/map")} />
        </View>

        {/* ── Города ── */}
        <View style={s.cityRow}>
          {CITY_OPTIONS.map((city) => {
            const active = selectedCity.name === city.name
            return (
              <Pressable key={city.name} onPress={() => updateProfile.mutate({ homeCity: city.name })}>
                <Text style={[s.mono, active && s.monoInk]}>{city.label.toUpperCase()}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* ── Каналы ── */}
        <View style={s.chanHead}>
          <Text style={s.mono}>{t("venuesNearby").toUpperCase()}</Text>
          <Text style={s.mono}>PTS/RSD</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
          {VENUE_FILTERS.map((filter) => {
            const active = filter.key === activeFilterKey
            return (
              <Pressable key={filter.key} onPress={() => setActiveFilterKey(filter.key)}>
                <Text style={[s.mono, active && s.monoInk]}>{filter.label.toUpperCase()}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {venues.length === 0 ? (
          <Text style={[s.mono, s.empty]}>{t("venue:noVenuesYet")}</Text>
        ) : (
          venues.slice(0, 6).map((venue) => {
            const dist = distanceKey(venue.distanceMeters)
            return (
            <Pressable
              key={venue.id}
              style={s.chan}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
            >
              <PixIcon name={iconForCategory(venue.category)} size={18} color={pts.ink} />
              <View style={s.chanBody}>
                <Text style={s.chanName} numberOfLines={1}>{venue.name}</Text>
                <Text style={s.chanMeta} numberOfLines={1}>
                  {dist ? t(dist.key, { n: dist.n }) : "—"}
                  {venue.enableDiscount && venue.maxDiscountPercent ? ` · −${venue.maxDiscountPercent} %` : ""}
                </Text>
              </View>
              <Text style={[s.rate, venue.pointsPerCurrency === bestRate && bestRate > 0 && s.rateBest]}>
                {venue.pointsPerCurrency ? venue.pointsPerCurrency.toFixed(3) : "—"}
              </Text>
            </Pressable>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

// ── Части ─────────────────────────────────────────────────────

function Pair({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.pair}>
      <Text style={s.pairLabel}>{label}</Text>
      <Text style={[s.pairValue, highlight && s.pairValueSig]}>{value}</Text>
    </View>
  )
}

function Key({
  tone, icon, label, onPress,
}: {
  tone: "sig" | "ink" | "pap"
  icon: "scan" | "pin" | "gift" | "nav"
  label: string
  onPress: () => void
}) {
  const bg = tone === "sig" ? pts.sig : tone === "ink" ? pts.ink : pts.paper2
  const fg = tone === "pap" ? pts.ink : pts.white
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.key, { backgroundColor: bg }, pressed && s.keyDown]}>
      <PixIcon name={icon} size={27} color={fg} />
      <Text style={[s.keyLabel, { color: fg }]} numberOfLines={2}>{label.toUpperCase()}</Text>
    </Pressable>
  )
}

// ── Стили ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: pts.paper },
  content: { paddingBottom: 118 },
  inner: { width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: PAD, paddingTop: 14 },

  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
  mark: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 16, color: pts.ink, letterSpacing: -0.5 },

  mono: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.2, color: pts.mid },
  monoSig: { color: pts.sig },
  monoInk: { color: pts.ink },

  ruleInk: { height: 1, backgroundColor: pts.ink },

  stack: { paddingTop: 14 },
  stackLine: { fontFamily: fonts.display, fontWeight: "700", fontSize: 27, lineHeight: 28, letterSpacing: -1.2 },
  tone1: { color: pts.ink },
  tone2: { color: pts.mid },
  tone3: { color: pts.dotOff },

  heroCap: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  hero: { paddingTop: 12 },

  pairs: { paddingTop: 18 },
  pair: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: pts.rule,
  },
  pairLabel: { fontFamily: fonts.body, fontSize: 13, color: pts.mid },
  pairValue: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 13, color: pts.ink, letterSpacing: -0.2 },
  pairValueSig: { color: pts.sig },

  keys: { flexDirection: "row", gap: 5, paddingTop: 18 },
  key: {
    flex: 1,
    height: 68,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: pts.ink,
    padding: 7,
    justifyContent: "space-between",
  },
  keyDown: { opacity: 0.75 },
  keyLabel: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 9, lineHeight: 11 },

  cityRow: { flexDirection: "row", gap: 14, paddingTop: 22 },

  chanHead: { flexDirection: "row", justifyContent: "space-between", paddingTop: 20, paddingBottom: 6 },
  filterRail: { gap: 14, paddingBottom: 10 },

  chan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: pts.rule,
  },
  chanBody: { flex: 1, minWidth: 0 },
  chanName: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 13, color: pts.ink, letterSpacing: -0.3 },
  chanMeta: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.8, color: pts.mid, marginTop: 2 },
  rate: { fontFamily: fonts.mono, fontSize: 12, color: pts.ink },
  rateBest: { color: pts.sig },

  empty: { paddingVertical: 26, textAlign: "center" },
})
