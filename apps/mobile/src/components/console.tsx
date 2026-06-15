/**
 * Device console — the Teenage-Engineering "the-app-is-a-gadget" shell.
 *
 *  ┌ DeviceChrome (cream body) ───────────────────┐
 *  │  ayoo                    SP·133  · · · · ·    │  ← BrandPlate (grille)
 *  │  ┌ LCD register (children) ─────────────────┐ │
 *  │  └──────────────────────────────────────────┘ │
 *  │  ┌ Keypad ── pad pad pad ───────────────────┐ │
 *  │  │           pad pad pad                     │ │
 *  │  └──────────────────────────────────────────┘ │
 *  └───────────────────────────────────────────────┘
 *
 * Pure presentational. All values/handlers come in as props.
 */

import { useEffect, useRef } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { fonts } from "../lib/theme"

// ── Console palette — warm cream hardware body, ink labels ─────
const BODY = ["#E4DCCB", "#DCD4C2"] as const   // beige hardware-body gradient
const INK = "#015634"
const DIM = "#8C887E"
const EDGE = "rgba(110,102,86,0.20)"           // extruded bottom edge
const HILITE = "rgba(255,255,255,0.95)"

export type PadAccent = "ink" | "green" | "orange"

// A light tactile click — Telegram's native haptics in-app, web vibration otherwise.
function tapFeedback() {
  if (typeof window === "undefined") return
  try {
    const hf = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void } } } }).Telegram?.WebApp?.HapticFeedback
    if (hf?.impactOccurred) { hf.impactOccurred("light"); return }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8)
  } catch { /* ignore */ }
}

/**
 * A single square tactile keypad button — K.O. II style, big chunky icon.
 *  - solid: the whole key is filled with `color`, icon/label rendered light.
 *  - otherwise: cream key with a big colored icon ("children's screen" look).
 */
export function PadKey({
  symbol,
  label,
  color = INK,
  edge,
  solid = false,
  onPress,
}: {
  symbol: string
  label: string
  color?: string
  edge?: string
  solid?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress() }}
      style={({ pressed }) => [
        s.pad,
        solid && { backgroundColor: color, borderBottomColor: edge ?? color, borderRightColor: edge ?? color },
        pressed && s.padPressed,
      ]}
    >
      {!solid && <View style={[s.padHairline, { backgroundColor: color }]} />}
      <Text style={[s.padSymbol, { color: solid ? "#FFFFFF" : color }]}>{symbol}</Text>
      <Text style={[s.padLabel, { fontFamily: fonts.pixel, color: solid ? "rgba(255,255,255,0.95)" : DIM }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export type PadDef = { key: string; symbol: string; label: string; color?: string; edge?: string; solid?: boolean; onPress: () => void }

/** A grid of pads — 3 per row, like an EP-133 sample keypad. */
export function Keypad({ pads }: { pads: PadDef[] }) {
  return (
    <View style={s.keypad}>
      {pads.map(({ key, ...p }) => (
        <View key={key} style={s.padCell}>
          <PadKey {...p} />
        </View>
      ))}
    </View>
  )
}

/** A recessed LCD panel — the device's main screen for EARN / SPEND modes.
 *  Optional accent tints the frame (green = earn, orange = spend). */
export function LcdScreen({ accent, children }: { accent?: string; children: React.ReactNode }) {
  return (
    <View style={[s.lcdScreen, accent ? { borderColor: accent } : null]}>
      {children}
    </View>
  )
}

/** Recessed LCD readout — a strip of segment-style cells (e.g. STREAK / WELCOME / QUESTS). */
export function Readout({ cells }: { cells: { label: string; value: string }[] }) {
  return (
    <View style={s.readout}>
      {cells.map((c, i) => (
        <View key={c.label} style={[s.readoutCell, i > 0 && s.readoutDivider]}>
          <Text style={[s.readoutValue, { fontFamily: fonts.pixel }]} numberOfLines={1}>{c.value}</Text>
          <Text style={[s.readoutLabel, { fontFamily: fonts.pixel }]} numberOfLines={1}>{c.label}</Text>
        </View>
      ))}
    </View>
  )
}

/** Brand plate — model name + a row of speaker-grille dots. */
function BrandPlate({ right }: { right?: React.ReactNode }) {
  return (
    <View style={s.plate}>
      <Text style={[s.brand, { fontFamily: fonts.displayHeavy }]}>ayoo</Text>
      <View style={s.plateRight}>
        {right}
        <Text style={[s.model, { fontFamily: fonts.pixel }]}>SP·133</Text>
        <View style={s.grille}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={s.grilleDot} />
          ))}
        </View>
      </View>
    </View>
  )
}

/** Hardware-style consent switch — flip it to "wake" the device.
 *  OFF (grey, knob left) → ON (green, knob right) with a tactile click. */
export function ConsentToggle({
  value,
  label,
  onChange,
}: {
  value: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 1 : 0, friction: 7, tension: 90, useNativeDriver: false }).start()
  }, [value, x])
  const knobX = x.interpolate({ inputRange: [0, 1], outputRange: [0, 28] })
  return (
    <Pressable
      onPress={() => { tapFeedback(); onChange(!value) }}
      style={s.consentRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Text style={[s.consentLabel, { fontFamily: fonts.pixel }]} numberOfLines={2}>{label}</Text>
      <View style={[s.toggleTrack, value && s.toggleTrackOn]}>
        <Animated.View style={[s.toggleKnob, { transform: [{ translateX: knobX }] }]} />
      </View>
    </Pressable>
  )
}

/** The cream device body that frames the whole console. */
export function DeviceChrome({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <LinearGradient colors={BODY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chrome}>
      <BrandPlate right={right} />
      {children}
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  // ── Device body ──
  chrome: {
    borderRadius: 34,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: HILITE,
    borderBottomWidth: 5,
    borderBottomColor: EDGE,
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },

  // ── Brand plate ──
  plate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  brand: { fontSize: 22, letterSpacing: -0.5, color: INK },
  plateRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  model: { fontSize: 7, letterSpacing: 0.5, color: DIM },
  grille: { flexDirection: "row", gap: 3 },
  grilleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(110,102,86,0.28)" },

  // ── Keypad ──
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  padCell: {
    // 3 per row: (100% - 2 gaps) / 3. Capped so a lone key doesn't balloon
    // to full width — single/double-key rows stay sensibly sized & centered.
    width: "31.5%",
    maxWidth: "48%",
    flexGrow: 1,
  },
  pad: {
    aspectRatio: 1.18,
    borderRadius: 18,
    backgroundColor: "#efeeea",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 5,
    borderTopColor: HILITE,
    borderLeftColor: "rgba(255,255,255,0.7)",
    borderRightColor: "rgba(120,112,96,0.12)",
    borderBottomColor: EDGE,
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 6,
  },
  padPressed: {
    borderBottomWidth: 2,
    transform: [{ translateY: 3 }],
    shadowOpacity: 0.12,
  },
  padHairline: { position: "absolute", top: 0, left: "26%", right: "26%", height: 2, borderRadius: 2, opacity: 0.55 },
  padSymbol: { fontSize: 42, lineHeight: 46, fontWeight: "900" },
  padLabel: { fontSize: 7, letterSpacing: 0.5, marginTop: 2 },

  // ── LCD main screen (earn/spend modes) ──
  lcdScreen: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: "#DBDBD7",
    borderWidth: 2,
    borderColor: "#C4C4BE",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  // ── LCD readout plate ──
  readout: {
    flexDirection: "row",
    backgroundColor: "#DBDBD7",
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: "#C4C4BE",
  },
  readoutCell: { flex: 1, alignItems: "center", gap: 5 },
  readoutDivider: { borderLeftWidth: 1, borderLeftColor: "rgba(110,102,86,0.18)" },
  readoutValue: { fontSize: 14, color: "#015634" },
  readoutLabel: { fontSize: 6, letterSpacing: 0.5, color: "#8C887E" },

  // ── Consent toggle (hardware switch on the chrome) ──
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  consentLabel: { flex: 1, fontSize: 8, lineHeight: 13, letterSpacing: 0.5, color: DIM },
  toggleTrack: {
    width: 56,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DBDBD7",
    borderWidth: 2,
    borderColor: "#C4C4BE",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackOn: { backgroundColor: "#015634", borderColor: "#013d24" },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(110,102,86,0.20)",
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
})
