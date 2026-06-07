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

// ── Pastel gradients (original) ───────────────────────────────
export const gradients = {
  aqua: ["#A7E8EE", "#84DCE4"] as const,
  ice: ["#F3F7FF", "#E6EDF8"] as const,
  lava: ["#EBFEFF", "#F5ECFF", "#FFF4FE", "#ECFFEB", "#FFFFFF"] as const,
  lavaGlass: [
    "rgba(235,254,255,0.82)",
    "rgba(245,236,255,0.76)",
    "rgba(255,244,254,0.70)",
    "rgba(236,255,235,0.74)",
    "rgba(255,255,255,0.84)",
  ] as const,
  black: ["#FFFFFF", "#F4F7FB", "#E1E6EF"] as const,
  graphite: ["#FDFEFF", "#EEF4FA", "#E1E6EF"] as const,
  pearl: ["#FFFFFF", "#EEF3FA"] as const,
  lime: ["#D9F875", "#BFF04C"] as const,
  blush: ["#F7D6EA", "#DDE6FF"] as const,
  rainbow: ["#A7E8EE", "#EAF1FF"] as const,
  rainbow2: ["#85F5F2", "#F199E3", "#9FEED3", "#D9E1FF"] as const,
  rainbow3: ["#F3F7FF", "#DDE6FF"] as const,
  rainbow4: ["#A7E8EE", "#F6F8FF"] as const,
  pink: ["#F7D6EA", "#E8D8FF"] as const,
  blue: ["#A7E8EE", "#8BD5E0"] as const,
  mint: ["#D9F875", "#BFF04C"] as const,
  gold: ["#F8E8B0", "#F3CD64"] as const,
  pinkBlue: ["#F7D6EA", "#A7E8EE"] as const,
  violet: ["#DDE6FF", "#C9C6FF"] as const,
}

// ── Neon rainbow gradients (vibrant mode) ─────────────────────
export const rainbowGradients = {
  hotPinkBlue:   ["#FF2D9B", "#2B6EFF"] as const,
  cyanMagenta:   ["#00F5FF", "#FF2D9B", "#8B3DFF"] as const,
  orangePurple:  ["#FF5500", "#C800FF"] as const,
  electricBlue:  ["#00CFFF", "#0041FF"] as const,
  neonGreen:     ["#39FF14", "#00F5A0"] as const,
  fireRed:       ["#FF2200", "#FF6B00"] as const,
  violetPink:    ["#9B00FF", "#FF2D9B"] as const,
  pillMain:      ["#FF2D9B", "#8B3DFF", "#2B6EFF"] as const,
  pillCyan:      ["#00F5FF", "#2B6EFF"] as const,
  pillOrange:    ["#FF5500", "#FF2D9B"] as const,
  darkBg:        ["#0D0D1E", "#0A0A18"] as const,
  darkSurface:   ["#1A1A30", "#141428"] as const,
  neonBalance:   ["#FF2D9B", "#00F5FF", "#39FF14"] as const,
}

// ── Physical Pass color tokens ─────────────────────────────────
export const pass = {
  // backgrounds
  bg:        "#F5F4F0",   // brutal warm off-white — screen bg
  card:      "#FFFFFF",   // white card surface
  dark:      "#000000",   // black — outlines and primary dark surfaces
  darkMid:   "#273AA8",   // blue — secondary accent
  // accents
  orange:    "#1f71b8",   // active brutal teal
  orangeLight: "#FFFFFF", // inactive buttons/chips
  mint:      "#B38BC8",   // lavender accent
  mintDark:  "#806828",   // brown accent
  // text
  textDark:  "#000000",   // on cream/white
  textMid:   "#000000",   // secondary on cream
  textMuted: "#000000",   // muted on cream
  textLight: "#FFFFFF",   // on dark navy
  textFaded: "#FFFFFF", // muted on dark navy
  // structure
  border:    "#000000",
  perf:      "#000000", // perforation dash color
}

// ── Pastel color shorthands ────────────────────────────────────
export const colors = {
  pink: "#ea5b0c",
  sky: "#1f71b8",
  mint: "#B38BC8",
  pinkSolid: "#ea5b0c",
  skySolid: "#1f71b8",
  mintSolid: "#B38BC8",
  indigoDark: "#000000",
  ink: "#000000",
  lavaBase: "#F5F4F0",
  lavaPink: "#ea5b0c",
  lavaBlue: "#1f71b8",
  lavaLime: "#B38BC8",
  lavaSalmon: "#FFFFFF",
  glassMilk: "#FFFFFF",
  glassSmoke: "#A3B1C6",
  panel: "#E1E6EF",
  cyan: "#85F5F2",
}

// ── Neon color shorthands ──────────────────────────────────────
export const neonColors = {
  pink:    "#FF2D9B",
  cyan:    "#00F5FF",
  purple:  "#8B3DFF",
  blue:    "#2B6EFF",
  green:   "#39FF14",
  orange:  "#FF5500",
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

// ── Pastel theme ───────────────────────────────────────────────
const pastelTheme: Theme = {
  isDark: false,
  bg: "#F5F4F0",
  bgLight: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#000000",
  textSecondary: "#000000",
  textMuted: "#000000",
  border: "#000000",
  shadowRaised: {
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  shadowRaisedSm: {
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  shadowInset: {
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
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
  display: Platform.OS === "web"
    ? "Arial Black, Helvetica Neue Condensed Black, Impact, SpaceGrotesk_700Bold, sans-serif"
    : "SpaceGrotesk_700Bold",
  displayHeavy: Platform.OS === "web"
    ? "Arial Black, Helvetica Neue Condensed Black, Impact, SpaceGrotesk_800ExtraBold, sans-serif"
    : "SpaceGrotesk_800ExtraBold",
  displayBlack: Platform.OS === "web"
    ? "Arial Black, Helvetica Neue Condensed Black, Impact, SpaceGrotesk_700Bold, sans-serif"
    : "SpaceGrotesk_700Bold",
  body: Platform.OS === "web"
    ? "Helvetica Neue, Arial, SpaceGrotesk_600SemiBold, sans-serif"
    : "SpaceGrotesk_600SemiBold",
  bodyBold: Platform.OS === "web"
    ? "Arial Black, Helvetica Neue Condensed Black, SpaceGrotesk_700Bold, sans-serif"
    : "SpaceGrotesk_700Bold",
}
