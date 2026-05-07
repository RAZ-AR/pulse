/**
 * PULSE design system — soft unicorn-neumorphic reference.
 *
 * Cool raised surfaces, pastel RGB gradients, large grotesk typography,
 * and pill controls with soft floating shadows.
 */

export type Theme = {
  bg: string
  bgLight: string
  surface: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  // Pre-built shadow recipes for Pressable / View
  shadowRaised: ShadowStyle
  shadowRaisedSm: ShadowStyle
  shadowInset: ShadowStyle // simulated — RN doesn't support inset
  shadowGlow: ShadowStyle
}

export type ShadowStyle = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

// ── Brand gradients (multi-stop arrays for expo-linear-gradient) ──
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

// Shorthands the design uses heavily
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

// ── Radius scale ─────────────────────────────────────────────
export const radius = {
  xs: 12,
  sm: 18,
  md: 30,
  pill: 99,
}

// ── Single light theme (no dark variant for v1) ──────────────
const lightTheme: Theme = {
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
    // RN doesn't support inset — caller layers a translucent gradient overlay instead.
    // This recipe just dampens the raised look on input fields.
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

export function useTheme(): Theme {
  // Dark mode is intentionally not implemented in the unicorn iteration —
  // the entire palette is light by design. Bring it back only if requested.
  return lightTheme
}

// ── Typography ───────────────────────────────────────────────
// Use these `fontFamily` values once Space Grotesk is loaded.
// Falls back to system if loading fails.
export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayHeavy: "SpaceGrotesk_800ExtraBold",
  displayBlack: "SpaceGrotesk_700Bold", // 900 not in google-fonts package; map to 700
  body: "SpaceGrotesk_500Medium",
  bodyBold: "SpaceGrotesk_700Bold",
}
