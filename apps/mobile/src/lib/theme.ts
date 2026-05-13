/**
 * PULSE design system — two modes:
 *  pastel  — soft unicorn-neumorphic (default)
 *  rainbow — neon vivid dark mode, inspired by gradient orb/pill references
 */

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

// ── Pastel color shorthands ────────────────────────────────────
export const colors = {
  pink: "#F7D6EA",
  sky: "#A7E8EE",
  mint: "#D9F875",
  pinkSolid: "#D96AA7",
  skySolid: "#73D0DA",
  mintSolid: "#BFF04C",
  indigoDark: "#6E7D8E",
  ink: "#6E7D8E",
  lavaBase: "#E1E6EF",
  lavaPink: "#F199E3",
  lavaBlue: "#9DCCFF",
  lavaLime: "#9FEED3",
  lavaSalmon: "#F5ECFF",
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
  bg: "#E1E6EF",
  bgLight: "#F7FAFF",
  surface: "#F9FBFF",
  text: "#6E7D8E",
  textSecondary: "#91A1B4",
  textMuted: "#B0D4E3",
  border: "rgba(255,255,255,0.72)",
  shadowRaised: {
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  shadowRaisedSm: {
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.36,
    shadowRadius: 12,
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
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 6,
  },
}

// ── Rainbow / neon dark theme ──────────────────────────────────
const rainbowTheme: Theme = {
  isDark: true,
  bg: "#0A0A18",
  bgLight: "#141428",
  surface: "#16162A",
  text: "#FFFFFF",
  textSecondary: "#C8BEFF",
  textMuted: "#7766AA",
  border: "rgba(139,61,255,0.28)",
  shadowRaised: {
    shadowColor: "#FF2D9B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  shadowRaisedSm: {
    shadowColor: "#8B3DFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  shadowInset: {
    shadowColor: "#2B6EFF",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#FF2D9B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 10,
  },
}

export function useTheme(): Theme {
  const mode = useColorMode((s) => s.mode)
  return mode === "rainbow" ? rainbowTheme : pastelTheme
}

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayHeavy: "SpaceGrotesk_800ExtraBold",
  displayBlack: "SpaceGrotesk_700Bold",
  body: "SpaceGrotesk_500Medium",
  bodyBold: "SpaceGrotesk_700Bold",
}
