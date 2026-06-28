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
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg"
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
function GrilleBoard({ tint = "#E5392A" }: { tint?: string }) {
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
  // Frameless live display embedded in the body — transparent so the corpus
  // colour shows straight through (matches any body tint), no chrome, no label.
  return (
    <View style={s.grilleScreen}>
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
  )
}

/** COLOR knob — a round colour swatch in the brand plate, sized to the head.
 *  Tap applies its colour to the body, then advances to the next swatch. */
function ColorKnob({ swatches, onPick }: {
  swatches: readonly (readonly [string, string])[]
  onPick: (c: readonly [string, string]) => void
}) {
  const [idx, setIdx] = useState(1 % swatches.length)
  const cur = swatches[idx] ?? swatches[0]!
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPick(cur); setIdx((n) => (n + 1) % swatches.length) }}
      style={({ pressed }) => [s.colorKnob, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
    >
      <LinearGradient colors={cur} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill as object} />
    </Pressable>
  )
}

export type GridAction = { glyph: string; label: string; color?: string; onPress: () => void }

// Slim rounded plus — narrow arms with fully semicircular ends. viewBox 100×110.
const PLUS_PATH =
  "M33 33 L33 17 Q33 0 50 0 Q67 0 67 17 L67 33 L83 33 Q100 33 100 50 Q100 67 83 67 L67 67 L67 83 Q67 100 50 100 Q33 100 33 83 L33 67 L17 67 Q0 67 0 50 Q0 33 17 33 Z"

/** Playdate-style + button — one extruded 3D cross in the body colour: dark
 *  side wall, body top face, top sheen. One tap target; its job is to SCAN. */
function PlusButton({ color, onPress }: { color: readonly [string, string]; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tapFeedback(); onPress() }} style={({ pressed }) => [s.plus, pressed && s.plusPressed]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 110">
        <Defs>
          <SvgGradient id="plusGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color[0]} />
            <Stop offset="1" stopColor={color[1]} />
          </SvgGradient>
          <SvgGradient id="plusSheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {/* ambient ground shadow */}
        <Path d={PLUS_PATH} fill="rgba(0,0,0,0.16)" transform="translate(0,9)" />
        {/* extruded dark side wall (gives the 3D height) */}
        <Path d={PLUS_PATH} fill="rgba(0,0,0,0.22)" transform="translate(0,4)" />
        {/* top face */}
        <Path d={PLUS_PATH} fill="url(#plusGrad)" />
        {/* top sheen */}
        <Path d={PLUS_PATH} fill="url(#plusSheen)" />
      </Svg>
    </Pressable>
  )
}

/** A bottom-row control key — round coloured button with the icon on it and the
 *  label underneath. Size matches the brand-plate colour knob (⌀40). */
function KeyButton({ action }: { action: GridAction }) {
  return (
    <View style={s.keyItem}>
      <Pressable
        onPress={() => { tapFeedback(); action.onPress() }}
        style={({ pressed }) => [s.keyDot, { backgroundColor: action.color ?? GLYPH }, pressed && s.keyDotPressed]}
      >
        <Text style={s.keyGlyph}>{action.glyph}</Text>
      </Pressable>
      <Text style={[s.keyLabel, { fontFamily: fonts.pixel }]} numberOfLines={1}>{action.label}</Text>
    </View>
  )
}

/** Control area — Glyph-Matrix + the SCAN plus on top, a row of 4 keys below. */
export function ModuleGrid({ map, check, reward, scan, earn, body }: {
  map: GridAction
  check: GridAction
  reward: GridAction
  scan: GridAction
  earn: GridAction
  body: readonly [string, string]
}) {
  return (
    <View style={s.controls}>
      <View style={s.controlsTop}>
        <View style={s.col}><GrilleBoard /></View>
        <View style={s.col}><PlusButton color={body} onPress={scan.onPress} /></View>
      </View>
      <View style={s.keyRow}>
        <KeyButton action={map} />
        <KeyButton action={check} />
        <KeyButton action={reward} />
        <KeyButton action={earn} />
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
function BrandPlate({ right, color }: {
  right?: React.ReactNode
  color?: { swatches: readonly (readonly [string, string])[]; onPick: (c: readonly [string, string]) => void }
}) {
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
        {color ? <ColorKnob swatches={color.swatches} onPick={color.onPick} /> : null}
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
export function DeviceChrome({ right, colors, color, children }: {
  right?: React.ReactNode
  colors?: readonly [string, string]
  color?: { swatches: readonly (readonly [string, string])[]; onPick: (c: readonly [string, string]) => void }
  children: React.ReactNode
}) {
  return (
    <LinearGradient colors={colors ?? BODY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chrome}>
      <BrandPlate right={right} {...(color ? { color } : {})} />
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

  // ── Control area ──
  controls: { gap: 10 },
  controlsTop: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  // Live glyph display — frameless, flush with the body (no key chrome, no label)
  grilleScreen: { flex: 1, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },

  // ── Playdate-style + SCAN button (single molded cross, body colour) ──
  plus: { flex: 1, aspectRatio: 1 },
  plusPressed: { transform: [{ scale: 0.97 }] },

  // ── Bottom row of 4 round coloured keys ──
  keyRow: { flexDirection: "row", gap: 10 },
  keyItem: { flex: 1, alignItems: "center", gap: 6 },
  keyDot: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.20)", borderTopColor: "rgba(255,255,255,0.55)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 6, elevation: 5,
  },
  keyDotPressed: { transform: [{ translateY: 2 }, { scale: 0.95 }], shadowOpacity: 0.18 },
  keyGlyph: { color: "#FFFFFF", fontSize: 18, lineHeight: 21, fontWeight: "900" },
  keyLabel: { fontSize: 7, letterSpacing: 0.5, color: DIM },

  // Glyph-Matrix (Nothing-Phone style pixel display) — sits on the aluminum face
  matrix: { alignItems: "center", justifyContent: "center", gap: 3 },
  matrixRow: { flexDirection: "row", gap: 3 },
  matrixDot: { width: 6, height: 6, borderRadius: 3 },
  matrixDotOff: { backgroundColor: "rgba(0,0,0,0.08)" },

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

  // ── Round colour knob (brand plate) — sized to the head ──
  colorKnob: {
    width: 40, height: 40, borderRadius: 20, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.18)", borderTopColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
  },

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
