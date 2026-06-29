/**
 * Gadget OS shell — the device language wrapped around every flow.
 * - ModeHeader: the brand plate echoed on each screen (face = home, pixel title, status dots).
 * - LcdPanel / LcdText: a dark recessed "screen" for key status data.
 * - GadgetCard: a clay list card (icon plate · serif name · pixel meta · LCD chips).
 * Palette is the fixed warm-clay device look (independent of the colour-mode theme).
 */
import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { fonts, typeScale } from "../lib/theme"
import { AyooFace } from "./AyooFace"

const CREAM = "#efeeea"
const EDGE = "rgba(110,102,86,0.16)"
const HILITE = "rgba(255,255,255,0.95)"
const INK = "#015634"
const DIM = "#8C887E"
const LCD = "#0E0F0C"
const LCD_INK = "#CFE3C4"
const LCD_EDGE = "#000000"
const RED = "#E5392A"

// ── ModeHeader — device brand-plate on every screen ───────────
export function ModeHeader({
  title, kicker, right, onFace,
}: { title: string; kicker?: string; right?: ReactNode; onFace?: () => void }) {
  const router = useRouter()
  return (
    <View style={s.header}>
      <Pressable onPress={onFace ?? (() => router.push("/" as Parameters<typeof router.push>[0]))} hitSlop={8} style={s.face}>
        <AyooFace width={54} />
      </Pressable>
      <View style={s.headTitle}>
        {kicker ? <Text style={[s.kicker, { fontFamily: fonts.pixel }]}>{kicker}</Text> : null}
        <Text style={[s.title, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{title}</Text>
      </View>
      {right ? <View style={s.right}>{right}</View> : <Dots />}
    </View>
  )
}

function Dots() {
  return (
    <View style={s.grille}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={[s.dot, i === 4 && s.dotRec]} />
      ))}
    </View>
  )
}

// ── LcdPanel — dark recessed status screen ────────────────────
export function LcdPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.lcd, style]}>{children}</View>
}
export function LcdText({ children }: { children: ReactNode }) {
  return <Text style={[s.lcdText, { fontFamily: fonts.pixel }]} numberOfLines={1}>{children}</Text>
}

// ── GadgetCard — clay list card in the device language ────────
export function GadgetCard({
  icon, name, meta, address, chips, onPress,
}: {
  icon: string
  name: string
  meta?: string
  address?: string
  chips?: string[]
  onPress?: () => void
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.cardPressed]}>
      <View style={s.cardIcon}><Text style={s.cardIconText}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{name}</Text>
        {meta ? <Text style={[s.cardMeta, { fontFamily: fonts.pixel }]} numberOfLines={1}>{meta}</Text> : null}
        {address ? <Text style={s.cardAddr} numberOfLines={1}>{address}</Text> : null}
        {chips && chips.length > 0 ? (
          <View style={s.chips}>
            {chips.map((c, i) => (
              <View key={i} style={s.chip}><Text style={[s.chipText, { fontFamily: fonts.pixel }]}>{c}</Text></View>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={s.arrow}>↗</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingTop: 2, marginBottom: 12 },
  face: { width: 54, justifyContent: "center" },
  headTitle: { flex: 1 },
  kicker: { color: DIM, fontSize: 8, letterSpacing: 1.5, marginBottom: 2 },
  title: { color: INK, fontSize: typeScale.display.size, lineHeight: typeScale.display.line },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  grille: { flexDirection: "row", gap: 3, alignItems: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.28)" },
  dotRec: { backgroundColor: RED },

  lcd: {
    backgroundColor: LCD, borderRadius: 12, borderWidth: 2, borderColor: LCD_EDGE,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  lcdText: { color: LCD_INK, fontSize: 9, letterSpacing: 0.5, flex: 1 },

  card: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: CREAM, borderRadius: 20, padding: 12, overflow: "hidden",
    borderTopWidth: 1.5, borderTopColor: HILITE, borderBottomWidth: 4, borderBottomColor: EDGE,
    shadowColor: "#9A958A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 3,
  },
  cardPressed: { borderBottomWidth: 2, transform: [{ translateY: 2 }] },
  cardIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: CREAM,
    borderWidth: 1, borderColor: "rgba(110,102,86,0.12)", alignItems: "center", justifyContent: "center",
  },
  cardIconText: { fontSize: 22 },
  cardName: { color: INK, fontSize: typeScale.card.size, lineHeight: typeScale.card.line },
  cardMeta: { color: DIM, fontSize: 8, letterSpacing: 0.4, marginTop: 4, textTransform: "uppercase" },
  cardAddr: { color: "#C9C4B4", fontSize: 12, marginTop: 2 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 },
  chip: { backgroundColor: "#DBDBD7", borderRadius: 7, borderWidth: 1, borderColor: "#C4C4BE", paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { color: INK, fontSize: 7, letterSpacing: 0.3 },
  arrow: { color: DIM, fontSize: 20 },
})
