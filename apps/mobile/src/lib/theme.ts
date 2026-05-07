/**
 * PULSE design system — editorial health-fintech reference.
 *
 * Cool white surfaces, black pill controls, cyan plan cards, large
 * grotesk typography, and soft floating shadows.
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
  lava: ["#B9F2EC", "#A9DFFF", "#FFD0E5", "#FFE0A6", "#C9F6B8"] as const,
  lavaGlass: [
    "rgba(185,242,236,0.78)",
    "rgba(169,223,255,0.68)",
    "rgba(255,208,229,0.70)",
    "rgba(255,224,166,0.60)",
    "rgba(201,246,184,0.64)",
  ] as const,
  black: ["#B9F2EC", "#A9DFFF", "#FFD0E5", "#FFE0A6", "#C9F6B8"] as const,
  graphite: ["#B9F2EC", "#A9DFFF", "#FFD0E5", "#FFE0A6", "#C9F6B8"] as const,
  pearl: ["#FFFFFF", "#EEF3FA"] as const,
  lime: ["#D9F875", "#BFF04C"] as const,
  blush: ["#F7D6EA", "#DDE6FF"] as const,
  rainbow: ["#A7E8EE", "#EAF1FF"] as const,
  rainbow2: ["#B9F2EC", "#A9DFFF", "#FFD0E5", "#FFE0A6", "#C9F6B8"] as const,
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
  indigoDark: "#05060A",
  ink: "#05060A",
  lavaBase: "#F7B8D5",
  lavaPink: "#FFD0E5",
  lavaBlue: "#A9DFFF",
  lavaLime: "#C9F6B8",
  lavaSalmon: "#FFE0A6",
  panel: "#EAF0FA",
  cyan: "#A7E8EE",
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
  bg: "#EEF3FB",
  bgLight: "#F7FAFF",
  surface: "#F7FAFF",
  text: "#05060A",
  textSecondary: "#606575",
  textMuted: "#A7ADBA",
  border: "rgba(5,6,10,0.08)",

  shadowRaised: {
    shadowColor: "#8290A7",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  shadowRaisedSm: {
    shadowColor: "#8290A7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  shadowInset: {
    // RN doesn't support inset — caller layers a translucent gradient overlay instead.
    // This recipe just dampens the raised look on input fields.
    shadowColor: "#8290A7",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#65C9D6",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
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
