/**
 * PULSE design system — neumorphic unicorn.
 *
 * Soft lavender base, deep indigo text, pastel rainbow gradients,
 * raised + inset shadows, Space Grotesk display.
 *
 * Tokens mirror the design handoff (pulse-screens-v3.jsx).
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
  // Full unicorn rainbow
  rainbow: ["#FFB3E6", "#B8A9FF", "#89D4FF", "#9DFFDB"] as const,
  rainbow2: ["#FF9BE2", "#C4AAFF", "#7DCFFF"] as const,
  rainbow3: ["#FFDBA4", "#FFB3E6", "#B8A9FF", "#89D4FF"] as const,
  rainbow4: ["#A8F0E0", "#89D4FF", "#B8A9FF"] as const,
  // Single-hue accents
  pink: ["#FFB3E6", "#FF85D2"] as const,
  blue: ["#89D4FF", "#6BB8F5"] as const,
  mint: ["#9DFFDB", "#5FEFC0"] as const,
  gold: ["#FFDBA4", "#FFB347"] as const,
  // Earn-card variant (pink → blue)
  pinkBlue: ["#FFB3E6", "#B8A9FF", "#89D4FF"] as const,
  // Profile / sponsored
  violet: ["#D8A9FF", "#B8A9FF"] as const,
}

// Shorthands the design uses heavily
export const colors = {
  // Brand accents (legacy from old theme — kept for back-compat)
  pink: "#FFB3E6",
  sky: "#89D4FF",
  mint: "#9DFFDB",
  // Strong versions for icons / badges
  pinkSolid: "#FF85D2",
  skySolid: "#6BB8F5",
  mintSolid: "#5FEFC0",
  // Status bar / dynamic island accent
  indigoDark: "#2D2B55",
}

// ── Radius scale ─────────────────────────────────────────────
export const radius = {
  xs: 10,
  sm: 14,
  md: 22,
  pill: 99,
}

// ── Single light theme (no dark variant for v1) ──────────────
const lightTheme: Theme = {
  bg: "#EEEDF8",
  bgLight: "#F5F4FF",
  surface: "#EEEDF8",
  text: "#2D2B55",
  textSecondary: "#9896B8",
  textMuted: "#C4C3D8",
  border: "rgba(163,160,200,0.18)",

  shadowRaised: {
    shadowColor: "#A3A0C8",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  shadowRaisedSm: {
    shadowColor: "#A3A0C8",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  shadowInset: {
    // RN doesn't support inset — caller layers a translucent gradient overlay instead.
    // This recipe just dampens the raised look on input fields.
    shadowColor: "#A3A0C8",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 0,
  },
  shadowGlow: {
    shadowColor: "#B4A0FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
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
