/**
 * ayoo pts–01 — плоский токен-сет.
 *
 * Один режим вместо двух. Ни теней, ни градиентов: иерархию держат
 * масштаб, тон и волосяная линия. Имена экспортов сохранены, чтобы
 * экраны, которые ещё не переписаны, продолжали собираться и уже
 * выглядели в новой палитре.
 */

import { Platform } from "react-native"

// ── Токены ────────────────────────────────────────────────────

export const pts = {
  paper: "#E9E5DB",    // грунт
  paper2: "#F1EEE6",   // плашка
  dotOff: "#D4CFC2",   // выключенная точка
  rule: "#CBC5B7",     // волосяная линия
  mid: "#8D8878",      // второй тон
  ink: "#14130F",      // тушь
  sig: "#EA5B0C",      // сигнал, фирменный
  white: "#FFFFFF",
} as const

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
  isDark: boolean
}

export type ShadowStyle = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

// В системе теней нет — все четыре набора пустые.
const noShadow: ShadowStyle = {
  shadowColor: "transparent",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
}

const theme: Theme = {
  isDark: false,
  bg: pts.paper,
  bgLight: pts.paper2,
  surface: pts.paper2,
  text: pts.ink,
  textSecondary: pts.mid,
  textMuted: pts.mid,
  border: pts.ink,
  shadowRaised: noShadow,
  shadowRaisedSm: noShadow,
  shadowInset: noShadow,
  shadowGlow: noShadow,
}

export function useTheme(): Theme {
  return theme
}

// ── Радиусы: только 0, 5 и 22 ─────────────────────────────────

export const radius = {
  xs: 0,
  sm: 5,
  md: 5,
  tile: 22,
  pill: 99,
}

// ── Шрифты ────────────────────────────────────────────────────
// Helvetica Neue системная на iOS и в Telegram-вебвью — грузить нечего.

const webSans = "\"Helvetica Neue\", Helvetica, Arial, sans-serif"
const nativeSans = Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif"

export const fonts = {
  display: Platform.OS === "web" ? webSans : nativeSans,
  displayHeavy: Platform.OS === "web" ? webSans : nativeSans,
  displayBlack: Platform.OS === "web" ? webSans : nativeSans,
  body: Platform.OS === "web" ? webSans : nativeSans,
  bodyBold: Platform.OS === "web" ? webSans : nativeSans,
  /** Сигнальное высказывание: капс + разрядка, только на оранжевом. */
  light: Platform.OS === "ios" ? "HelveticaNeue-Thin" : Platform.OS === "web" ? webSans : "sans-serif-light",
  mono: Platform.OS === "web"
    ? "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace"
    : Platform.OS === "ios" ? "Menlo" : "monospace",
}

// ── Совместимость ─────────────────────────────────────────────
// Ниже — те же имена, что и раньше, но все значения ведут в токены выше.
// Экраны из очереди на переписывание собираются и не выпадают из палитры.

export const colors = {
  pink: pts.sig,
  sky: pts.ink,
  mint: pts.mid,
  pinkSolid: pts.sig,
  skySolid: pts.ink,
  mintSolid: pts.mid,
  indigoDark: pts.ink,
  ink: pts.ink,
  lavaBase: pts.paper,
  lavaPink: pts.sig,
  lavaBlue: pts.ink,
  lavaLime: pts.mid,
  lavaSalmon: pts.paper2,
  glassMilk: pts.paper2,
  glassSmoke: pts.mid,
  panel: pts.rule,
  cyan: pts.dotOff,
}

export const neonColors = {
  pink: pts.sig,
  cyan: pts.ink,
  purple: pts.mid,
  blue: pts.ink,
  green: pts.sig,
  orange: pts.sig,
  red: pts.sig,
  yellow: pts.sig,
  white: pts.white,
  muted: pts.mid,
  surface: pts.paper2,
  bg: pts.paper,
}

export const pass = {
  bg: pts.paper,
  card: pts.paper2,
  dark: pts.ink,
  darkMid: pts.ink,
  orange: pts.sig,
  orangeLight: pts.paper2,
  mint: pts.mid,
  mintDark: pts.mid,
  textDark: pts.ink,
  textMid: pts.ink,
  textMuted: pts.mid,
  textLight: pts.white,
  textFaded: pts.white,
  border: pts.ink,
  perf: pts.rule,
}

// Градиенты в системе запрещены: каждая пара — один и тот же цвет,
// поэтому LinearGradient в непереписанных экранах даёт плоскую заливку.
const flat = (c: string) => [c, c] as const

export const gradients = {
  aqua: flat(pts.paper2),
  ice: flat(pts.paper2),
  lava: flat(pts.paper),
  lavaGlass: flat(pts.paper2),
  black: flat(pts.paper2),
  graphite: flat(pts.paper2),
  pearl: flat(pts.paper2),
  lime: flat(pts.sig),
  blush: flat(pts.paper2),
  rainbow: flat(pts.paper2),
  rainbow2: flat(pts.paper2),
  rainbow3: flat(pts.paper2),
  rainbow4: flat(pts.paper2),
  pink: flat(pts.sig),
  blue: flat(pts.ink),
  mint: flat(pts.mid),
  gold: flat(pts.sig),
  pinkBlue: flat(pts.sig),
  violet: flat(pts.mid),
}

export const rainbowGradients = {
  hotPinkBlue: flat(pts.sig),
  cyanMagenta: flat(pts.sig),
  orangePurple: flat(pts.sig),
  electricBlue: flat(pts.ink),
  neonGreen: flat(pts.sig),
  fireRed: flat(pts.sig),
  violetPink: flat(pts.mid),
  pillMain: flat(pts.sig),
  pillCyan: flat(pts.ink),
  pillOrange: flat(pts.sig),
  darkBg: flat(pts.paper),
  darkSurface: flat(pts.paper2),
  neonBalance: flat(pts.sig),
}
