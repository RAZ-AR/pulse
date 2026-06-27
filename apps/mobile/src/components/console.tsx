/**
 * Device console — the Teenage-Engineering "the-app-is-a-gadget" shell.
 * Dark edition, reference-faithful: near-black body, brushed-aluminum modules,
 * a literal control grid (speaker grille · dial · square · REC · PLAY · two knobs).
 *
 *  ┌ DeviceChrome (near-black body) ───────────────┐
 *  │  ayoo                    SP·133  · · · · ·     │
 *  │  ┌ LCD screen (children) ───────────────────┐ │
 *  │  └──────────────────────────────────────────┘ │
 *  │  ┌ ModuleGrid ── grille · dial · REC · knob ─┐ │
 *  │  └──────────────────────────────────────────┘ │
 *  └───────────────────────────────────────────────┘
 *
 * Pure presentational. All values/handlers come in as props.
 */

import { useEffect, useRef, useState } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { fonts } from "../lib/theme"
import { AyooFace } from "./AyooFace"

// ── Console palette — near-black body, brushed-aluminum modules ──
const BODY = ["#DBDBD6", "#BCBCB6"] as const     // light brushed-aluminum hardware body
const ALU = ["#F6F6F3", "#E0E0DC", "#C6C6C1"] as const  // brushed-aluminum face
const ALU_HI = "rgba(255,255,255,0.95)"           // aluminum top highlight
const ALU_EDGE = "rgba(0,0,0,0.26)"               // extruded bottom edge
const INK = "#2A2A27"                              // dark labels on the light aluminum body
const DIM = "#83837A"                              // muted labels on the dark body
const GLYPH = "#2A2A27"                             // dark glyph on aluminum
const RED = "#E5392A"                               // single hardware accent (REC red)
const RED_EDGE = "#A8281B"
const SCREEN = "#0E0F0C"                            // recessed dark LCD glass
const SCREEN_EDGE = "#000000"

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

// ════════════════════════════════════════════════════════════════
//  Onboarding keypad (kept for onboarding.tsx) — aluminum tiles.
// ════════════════════════════════════════════════════════════════

export function PadKey({
  symbol,
  label,
  color = RED,
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
      style={({ pressed }) => [s.pad, pressed && s.padPressed]}
    >
      <LinearGradient colors={ALU} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill as object} />
      {solid ? (
        <View style={[s.knobEmblem, { backgroundColor: color, borderBottomColor: edge ?? color }]}>
          <Text style={s.knobEmblemSymbol}>{symbol}</Text>
        </View>
      ) : (
        <Text style={[s.padSymbol, { color: GLYPH }]}>{symbol}</Text>
      )}
      <Text style={[s.padLabel, { fontFamily: fonts.pixel, color: solid ? color : DIM }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export type PadDef = { key: string; symbol: string; label: string; color?: string; edge?: string; solid?: boolean; onPress: () => void }

/** A grid of pads — 3 per row, like an EP-133 sample keypad. (Onboarding.) */
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

// ════════════════════════════════════════════════════════════════
//  Reference control modules — brushed-aluminum hardware controls.
// ════════════════════════════════════════════════════════════════

/** Brushed-aluminum tile that frames a single control + its label. */
function Tile({ children, label, onPress, style }: {
  children: React.ReactNode
  label?: string
  onPress?: () => void
  style?: object
}) {
  return (
    <Pressable
      onPress={onPress ? () => { tapFeedback(); onPress() } : undefined}
      style={({ pressed }) => [s.tile, style as object, pressed && onPress ? s.tilePressed : null]}
    >
      <LinearGradient colors={ALU} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill as object} />
      <View style={s.tileInner}>{children}</View>
      {label ? <Text style={[s.tileLabel, { fontFamily: fonts.pixel }]} numberOfLines={1}>{label}</Text> : null}
    </Pressable>
  )
}

// ── Glyph-Matrix frames — 11×11 pixel art ("X" = lit dot) ──────
const G_HI = [
  "...........",
  "...........",
  "...........",
  ".X.X.XXX.X.",
  ".X.X..X..X.",
  ".XXX..X..X.",
  ".X.X..X....",
  ".X.X.XXX.X.",
  "...........",
  "...........",
  "...........",
]
const G_HEART_A = [
  "...........",
  "..XX...XX..",
  ".XXXXXXXXX.",
  ".XXXXXXXXX.",
  ".XXXXXXXXX.",
  "..XXXXXXX..",
  "...XXXXX...",
  "....XXX....",
  ".....X.....",
  "...........",
  "...........",
]
const G_HEART_B = [
  "...........",
  "...........",
  "..XX...XX..",
  ".XXXXXXXXX.",
  ".XXXXXXXXX.",
  "..XXXXXXX..",
  "...XXXXX...",
  "....XXX....",
  ".....X.....",
  "...........",
  "...........",
]
const G_STAR_A = [
  ".....X.....",
  ".....X.....",
  "....XXX....",
  ".X..XXX..X.",
  ".XXXXXXXXX.",
  "..XXXXXXX..",
  ".X..XXX..X.",
  "....XXX....",
  ".....X.....",
  ".....X.....",
  "...........",
]
const G_STAR_B = [
  "...........",
  ".....X.....",
  "....XXX....",
  "...XXXXX...",
  "..XXXXXXX..",
  "...XXXXX...",
  "....XXX....",
  ".....X.....",
  "...........",
  "...........",
  "...........",
]

/** Glyph-Matrix module (Nothing-Phone style) — a pixel display in the body
 *  tint that plays HI on start, an idle heartbeat, and a star on point gains. */
function GrilleBoard({ label = "AYOO LIVE", tint = "#E5392A", onPress }: { label?: string; tint?: string; onPress?: () => void }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 460)
    return () => clearInterval(id)
  }, [])
  // timeline: HI on start → idle heartbeat, with a star twinkle every ~12s.
  let frame: string[]
  if (tick < 5) frame = G_HI
  else {
    const t = tick - 5
    const cyc = t % 26
    if (cyc >= 22) frame = cyc % 2 ? G_STAR_A : G_STAR_B
    else frame = t % 2 ? G_HEART_A : G_HEART_B
  }
  return (
    <Pressable
      onPress={onPress ? () => { tapFeedback(); onPress() } : undefined}
      style={({ pressed }) => [s.tile, s.grilleTile, pressed && onPress ? s.tilePressed : null]}
    >
      <LinearGradient colors={ALU} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill as object} />
      <View style={s.matrixPlate}>
        <View style={s.matrix}>
          {frame.map((row, r) => (
            <View key={r} style={s.matrixRow}>
              {row.split("").map((ch, c) => (
                <View key={c} style={[s.matrixDot, ch === "X" ? { backgroundColor: tint } : s.matrixDotOff]} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={s.ledStrip}>
        <View style={[s.ledDot, { backgroundColor: tint }]} />
        <Text style={[s.ledLabel, { fontFamily: fonts.pixel }]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  )
}

/** COLOR key — a bare colour swatch. Tap applies its colour to the body,
 *  then advances the swatch to the next colour. No icon, no label. */
function ColorTile({ swatches, onPick }: {
  swatches: readonly (readonly [string, string])[]
  onPick: (c: readonly [string, string]) => void
}) {
  const [idx, setIdx] = useState(1 % swatches.length)
  const cur = swatches[idx] ?? swatches[0]!
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPick(cur); setIdx((n) => (n + 1) % swatches.length) }}
      style={({ pressed }) => [s.tile, s.smTile, pressed && s.tilePressed]}
    >
      <LinearGradient colors={cur} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill as object} />
    </Pressable>
  )
}

export type GridAction = { glyph: string; label: string; color?: string; onPress: () => void }

/** A flat glyph control — just the icon on a brushed-aluminum tile, no rings. */
function GlyphTile({ action, big = false }: { action: GridAction; big?: boolean }) {
  return (
    <Tile style={big ? s.bigTile : s.smTile} label={action.label} onPress={action.onPress}>
      <Text style={[big ? s.controlGlyphLg : s.controlGlyph, { color: action.color ?? GLYPH }]}>{action.glyph}</Text>
    </Tile>
  )
}

/** The control grid — flat glyph buttons, a COLOR swatch, and the Glyph-Matrix. */
export function ModuleGrid({ map, check, color, reward, scan, earn, matrixTint, onStatus }: {
  map: GridAction
  check: GridAction
  color: { swatches: readonly (readonly [string, string])[]; onPick: (c: readonly [string, string]) => void }
  reward: GridAction
  scan: GridAction
  earn: GridAction
  matrixTint?: string
  onStatus?: () => void
}) {
  return (
    <View style={s.grid}>
      {/* left column — Glyph-Matrix + big SCAN */}
      <View style={s.col}>
        <GrilleBoard {...(matrixTint ? { tint: matrixTint } : {})} {...(onStatus ? { onPress: onStatus } : {})} />
        <GlyphTile action={scan} big />
      </View>

      {/* right column — map/check, color/reward, big EARN */}
      <View style={s.col}>
        <View style={s.row}>
          <GlyphTile action={map} />
          <GlyphTile action={check} />
        </View>
        <View style={s.row}>
          <ColorTile swatches={color.swatches} onPick={color.onPick} />
          <GlyphTile action={reward} />
        </View>
        <GlyphTile action={earn} big />
      </View>
    </View>
  )
}

// ════════════════════════════════════════════════════════════════
//  Screens / readouts / chrome
// ════════════════════════════════════════════════════════════════

/** A recessed LCD panel — the device's main screen for EARN / SPEND modes.
 *  `dark` (default) = deep glass; otherwise the original light-grey LCD. */
export function LcdScreen({ accent, dark = true, children }: { accent?: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <View style={[s.lcdScreen, dark ? null : s.lcdScreenLight, accent ? { borderColor: accent } : null]}>
      {children}
    </View>
  )
}

/** Small sun/moon button that flips the screen theme. Sits in the brand plate. */
export function ScreenToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={() => { tapFeedback(); onToggle() }}
      style={({ pressed }) => [s.screenToggle, pressed && { opacity: 0.7 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
    >
      <Text style={s.screenToggleGlyph}>{dark ? "☀" : "☾"}</Text>
    </Pressable>
  )
}

/** Recessed LCD readout — a strip of segment-style cells. */
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

/** Brand plate — model name + a row of speaker-grille dots (one red REC dot). */
function BrandPlate({ right }: { right?: React.ReactNode }) {
  return (
    <View style={s.plate}>
      <View style={s.brand}>
        <AyooFace width={87} />
      </View>
      <View style={s.plateRight}>
        {right}
        <Text style={[s.model, { fontFamily: fonts.pixel }]}>SP·133</Text>
        <View style={s.grille}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[s.grilleDot, i === 4 && s.grilleDotRec]} />
          ))}
        </View>
      </View>
    </View>
  )
}

/** Hardware-style consent switch — flip it to "wake" the device. */
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

/** The device body that frames the whole console. `colors` overrides the body tint. */
export function DeviceChrome({ right, colors, children }: { right?: React.ReactNode; colors?: readonly [string, string]; children: React.ReactNode }) {
  return (
    <LinearGradient colors={colors ?? BODY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chrome}>
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
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0,0,0,0.6)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
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
  brand: { width: 87, height: 39, justifyContent: "center" },
  plateRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  model: { fontSize: 7, letterSpacing: 0.5, color: DIM },
  grille: { flexDirection: "row", gap: 3 },
  grilleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.28)" },
  grilleDotRec: { backgroundColor: RED },

  // ── Onboarding keypad ──
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  padCell: { width: "31.5%", maxWidth: "48%", flexGrow: 1 },
  pad: {
    aspectRatio: 1.18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 5,
    borderTopColor: ALU_HI,
    borderLeftColor: "rgba(255,255,255,0.7)",
    borderRightColor: "rgba(0,0,0,0.10)",
    borderBottomColor: ALU_EDGE,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  padPressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }], shadowOpacity: 0.18 },
  padSymbol: { fontSize: 42, lineHeight: 46, fontWeight: "900" },
  padLabel: { fontSize: 7, letterSpacing: 0.5, marginTop: 2 },
  knobEmblem: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center", borderBottomWidth: 4,
  },
  knobEmblemSymbol: { fontSize: 30, lineHeight: 33, fontWeight: "900", color: "#FFFFFF" },

  // ── Reference control grid ──
  grid: { flexDirection: "row", gap: 10 },
  col: { flex: 1, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  tile: {
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderTopWidth: 1.5,
    borderTopColor: ALU_HI,
    borderBottomWidth: 4,
    borderBottomColor: ALU_EDGE,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 9,
    elevation: 5,
  },
  tilePressed: { borderBottomWidth: 2, transform: [{ translateY: 2 }], shadowOpacity: 0.2 },
  tileInner: { alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 7, letterSpacing: 0.5, color: DIM, marginTop: 5 },
  smTile: { flex: 1, height: 92 },
  bigTile: { height: 124 },
  grilleTile: { height: 196, justifyContent: "space-between", paddingVertical: 12 },

  // flat control glyphs (no rings around the icon)
  controlGlyph: { fontSize: 38, lineHeight: 42, fontWeight: "900" },
  controlGlyphLg: { fontSize: 62, lineHeight: 66, fontWeight: "900" },

  // Glyph-Matrix (Nothing-Phone style pixel display) — sits on the aluminum face
  matrixPlate: {
    flex: 1, alignSelf: "stretch", marginTop: 2,
    alignItems: "center", justifyContent: "center",
  },
  matrix: { alignItems: "center", justifyContent: "center", gap: 3 },
  matrixRow: { flexDirection: "row", gap: 3 },
  matrixDot: { width: 6, height: 6, borderRadius: 3 },
  matrixDotOff: { backgroundColor: "rgba(0,0,0,0.08)" },
  ledStrip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "stretch", marginHorizontal: 8,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: SCREEN, borderWidth: 1, borderColor: SCREEN_EDGE,
  },
  ledDot: { width: 8, height: 8, borderRadius: 4 },
  ledLabel: { flex: 1, fontSize: 7, letterSpacing: 0.5, color: "#9A9A8E" },

  // ── LCD main screen (earn/spend modes) ──
  lcdScreen: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: SCREEN,
    borderWidth: 2,
    borderColor: "#23241E",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  lcdScreenLight: { backgroundColor: "#DBDBDB", borderColor: "#C4C4BE" },

  // ── Screen-theme toggle ──
  screenToggle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#26261F",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.35)",
  },
  screenToggleGlyph: { fontSize: 13, lineHeight: 16, color: "#F2B441" },

  // ── LCD readout plate ──
  readout: {
    flexDirection: "row",
    backgroundColor: SCREEN,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: "#23241E",
  },
  readoutCell: { flex: 1, alignItems: "center", gap: 5 },
  readoutDivider: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.10)" },
  readoutValue: { fontSize: 14, color: "#E4E3DC" },
  readoutLabel: { fontSize: 6, letterSpacing: 0.5, color: DIM },

  // ── Consent toggle ──
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  consentLabel: { flex: 1, fontSize: 8, lineHeight: 13, letterSpacing: 0.5, color: INK },
  toggleTrack: {
    width: 56, height: 30, borderRadius: 15,
    backgroundColor: "#000000", borderWidth: 2, borderColor: "#33332D",
    padding: 2, justifyContent: "center",
  },
  toggleTrackOn: { backgroundColor: RED, borderColor: RED_EDGE },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#EDECE6", borderWidth: 1, borderColor: "rgba(0,0,0,0.25)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 3,
  },
})
