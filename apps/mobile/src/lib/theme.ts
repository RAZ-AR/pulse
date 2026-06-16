/**
 * ayoo design system — two modes:
 *  pastel  — soft unicorn-neumorphic (default)
 *  rainbow — neon vivid dark mode, inspired by gradient orb/pill references
 */

import { Platform } from "react-native"
import { useColorMode } from "../store/colorMode"

export type Theme = {
  bg: string
  bgLight: string
  surface: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  shadowRaised: ShadowStyle
  shadowRaisedSm: ShadowStyle
  shadowInset: ShadowStyle
  shadowGlow: ShadowStyle
  // rainbow-mode extras
  isDark: boolean
}

export type ShadowStyle = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

// ── Clay gradients (soft-plastic styleguide) ──────────────────
export const gradients = {
  aqua: ["#BCE6D2", "#A2DBBE"] as const,
  ice: ["#FBFAF7", "#F0EDE6"] as const,
  lava: ["#FFFFFF", "#FBFAF7", "#F6F3EC", "#F1FAF4", "#FFFFFF"] as const,
  lavaGlass: [
    "rgba(255,255,255,0.86)",
    "rgba(250,248,242,0.80)",
    "rgba(244,250,246,0.74)",
    "rgba(238,246,240,0.78)",
    "rgba(255,255,255,0.88)",
  ] as const,
  black: ["#F4F3F1", "#efeeea", "#efeeea"] as const,
  graphite: ["#F4F3F1", "#efeeea", "#E6E5E1"] as const,
  pearl: ["#F4F3F1", "#efeeea"] as const,
  lime: ["#BFEAD2", "#97DDB6"] as const,
  blush: ["#F2E7DD", "#E6DBF0"] as const,
  rainbow: ["#BCE6D2", "#F0EDE6"] as const,
  rainbow2: ["#BCE6D2", "#CFE9DC", "#B7E8CE", "#E3EFE7"] as const,
  rainbow3: ["#FBFAF7", "#E9F3EC"] as const,
  rainbow4: ["#BCE6D2", "#FAF8F4"] as const,
  pink: ["#F2E7DD", "#E9E1F0"] as const,
  blue: ["#BCE6D2", "#9FD6BC"] as const,
  mint: ["#BCE9D4", "#8FDDB4"] as const,
  gold: ["#F6E9B8", "#EFD98A"] as const,
  pinkBlue: ["#F2E7DD", "#BCE6D2"] as const,
  violet: ["#E3EFE7", "#CDE2D6"] as const,
}

// ── Neon rainbow gradients (vibrant mode) ─────────────────────
export const rainbowGradients = {
  hotPinkBlue:   ["#FF2D9B", "#2B6EFF"] as const,
  cyanMagenta:   ["#00F5FF", "#FF2D9B", "#8B3DFF"] as const,
  orangePurple:  ["#fd4600", "#C800FF"] as const,
  electricBlue:  ["#00CFFF", "#0041FF"] as const,
  neonGreen:     ["#39FF14", "#00F5A0"] as const,
  fireRed:       ["#FF2200", "#FF6B00"] as const,
  violetPink:    ["#9B00FF", "#FF2D9B"] as const,
  pillMain:      ["#FF2D9B", "#8B3DFF", "#2B6EFF"] as const,
  pillCyan:      ["#00F5FF", "#2B6EFF"] as const,
  pillOrange:    ["#fd4600", "#FF2D9B"] as const,
  darkBg:        ["#0D0D1E", "#0A0A18"] as const,
  darkSurface:   ["#1A1A30", "#141428"] as const,
  neonBalance:   ["#FF2D9B", "#00F5FF", "#39FF14"] as const,
}

// ── Clay color shorthands (soft-plastic styleguide) ────────────
export const colors = {
  pink: "#F1E3DA",
  sky: "#CDEBDD",
  mint: "#A9E2C6",
  pinkSolid: "#CDA38F",
  skySolid: "#8FCBB0",
  mintSolid: "#8AD9B4",
  indigoDark: "#015634",
  ink: "#015634",
  lavaBase: "#ECE9E1",
  lavaPink: "#E8DACE",
  lavaBlue: "#CBE7DA",
  lavaLime: "#B7E8CE",
  lavaSalmon: "#F3EADF",
  glassMilk: "#FFFFFF",
  glassSmoke: "#C9C4B6",
  panel: "#ECE9E1",
  cyan: "#BCE6D2",
}

// ── Neon color shorthands ──────────────────────────────────────
export const neonColors = {
  pink:    "#FF2D9B",
  cyan:    "#00F5FF",
  purple:  "#8B3DFF",
  blue:    "#2B6EFF",
  green:   "#39FF14",
  orange:  "#fd4600",
  red:     "#FF2200",
  yellow:  "#FFE600",
  white:   "#FFFFFF",
  muted:   "#8877BB",
  surface: "#141428",
  bg:      "#0A0A18",
}

export const radius = {
  xs: 12,
  sm: 18,
  md: 30,
  pill: 99,
}

// ── Clay theme (soft-plastic styleguide) ───────────────────────
// Warm paper bg, white extruded surfaces, soft downward shadows.
const pastelTheme: Theme = {
  isDark: false,
  bg: "#efeeea",
  bgLight: "#efeeea",
  surface: "#efeeea",
  text: "#015634",
  textSecondary: "#6E6C64",
  textMuted: "#9C9A91",
  border: "#DEDDD7",
  shadowRaised: {
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 12,
  },
  shadowRaisedSm: {
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  shadowInset: {
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 8,
  },
}

// ── Rainbow volumetric theme (light grey bg + vivid 3D gradient elements) ─
const rainbowTheme: Theme = {
  isDark: false,
  bg: "#E4E4E9",       // neutral grey like the reference image background
  bgLight: "#EDEDF2",
  surface: "#F2F2F6",
  text: "#1A1A2E",
  textSecondary: "#44446A",
  textMuted: "#8888AA",
  border: "rgba(255,255,255,0.72)",
  shadowRaised: {
    shadowColor: "#8B3DFF",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  shadowRaisedSm: {
    shadowColor: "#FF2D9B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  shadowInset: {
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#FF2D9B",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
}

export function useTheme(): Theme {
  const mode = useColorMode((s) => s.mode)
  return mode === "rainbow" ? rainbowTheme : pastelTheme
}

export const fonts = {
  display: Platform.OS === "web" ? "\"Instrument Serif\", serif" : "SpaceGrotesk_700Bold",
  displayHeavy: Platform.OS === "web" ? "\"Instrument Serif\", serif" : "SpaceGrotesk_800ExtraBold",
  displayBlack: Platform.OS === "web" ? "\"Instrument Serif\", serif" : "SpaceGrotesk_700Bold",
  serif: Platform.OS === "web" ? "\"Instrument Serif\", serif" : "SpaceGrotesk_700Bold",
  roboto: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_500Medium",
  robotoMedium: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_600SemiBold",
  robotoBold: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_700Bold",
  robotoBlack: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_800ExtraBold",
  body: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_500Medium",
  bodyBold: Platform.OS === "web" ? "Roboto, sans-serif" : "SpaceGrotesk_700Bold",
  // Retro LCD pixel font — Press Start 2P on web (Telegram), native fallback.
  pixel: Platform.OS === "web" ? "\"Press Start 2P\", monospace" : "SpaceGrotesk_700Bold",
}
