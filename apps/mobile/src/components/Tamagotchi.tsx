/**
 * Tamagotchi window — a retro LCD device that frames the AyooPet.
 *
 *  ┌ case ───────────────────────────┐
 *  │ ┌ stat bars ──────────────────┐ │   HUNGER HYGIENE SMARTS …
 *  │ └─────────────────────────────┘ │
 *  │ ┌ LCD screen (olive + dots) ──┐ │   coins ▸  · pet roams · name
 *  │ └─────────────────────────────┘ │
 *  └─────────────────────────────────┘
 *
 * Pure presentational. All values come in as props.
 * `dark` flips the screen theme: dark glass + light monochrome (default),
 * or the original light-grey LCD. Coloured details (the red "speak" flash)
 * stay coloured in both.
 */

import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg"
import { fonts } from "../lib/theme"
import { AyooPet } from "./AyooPet"

// Standard pet names (Latin — render in the Press Start 2P pixel font).
export const PET_NAMES: Record<string, string> = {
  EGG: "Egg",
  HATCHLING: "Hatchling",
  KID: "Kid",
  FOX: "Fox",
  DRAGON: "Dragon",
  PHOENIX: "Phoenix",
}

export function petDefaultName(petKey: string): string {
  return PET_NAMES[petKey] ?? "Pet"
}

// ── Two screen palettes — light (original) / dark (deep-glass green) ──
type Lcd = {
  case: readonly [string, string]
  caseBorder: string
  caseEdge: string
  caseShadow: string
  statsBg: string
  screen: string
  screenEdge: string
  dot: string
  ink: string
  inkDim: string
  track: string
  petInk: string | undefined  // light pet on dark glass; undefined = default dark ink
}

const LCD_LIGHT: Lcd = {
  case: ["#FFFFFF", "#E9EDF4"],
  caseBorder: "rgba(255,255,255,0.9)",
  caseEdge: "#D7DCE6",
  caseShadow: "#C9C4B4",
  statsBg: "rgba(255,255,255,0.55)",
  screen: "#DBDBDB",
  screenEdge: "#C4C4C4",
  dot: "#CBCBCB",
  ink: "#3A3F47",
  inkDim: "#9AA0AB",
  track: "#CFCFCF",
  petInk: undefined,
}

const LCD_DARK: Lcd = {
  case: ["#34342E", "#1C1C18"],
  caseBorder: "rgba(255,255,255,0.10)",
  caseEdge: "#0E0E0C",
  caseShadow: "#000000",
  statsBg: "rgba(255,255,255,0.04)",
  screen: "#0E0F0C",
  screenEdge: "#000000",
  dot: "rgba(255,255,255,0.06)",
  ink: "#CFE3C4",
  inkDim: "#6E7466",
  track: "#23241E",
  petInk: "#CFE3C4",
}

export type Stat = { label: string; value: number }

export function TamagotchiWindow({
  petKey,
  streak,
  petName,
  coins,
  lifetimePoints,
  ringProgress,
  weeklyEarned,
  weeklySpent,
  earnedLabel,
  spentLabel,
  words,
  info,
  onOpen,
  dark = true,
}: {
  petKey: string
  streak: number
  petName?: string | null | undefined
  coins: number
  lifetimePoints: number
  ringProgress: number // 0..1 progress toward the next pet
  weeklyEarned: number
  weeklySpent: number
  earnedLabel: string
  spentLabel: string
  words?: string[] | undefined
  info?: { label: string; value: string }[] | undefined
  onOpen?: (() => void) | undefined
  dark?: boolean
}) {
  const name = (petName?.trim() || petDefaultName(petKey))
  const lcd = dark ? LCD_DARK : LCD_LIGHT

  // Every so often the pet "says" a localized word, then goes back to its name.
  const [flash, setFlash] = useState<string | null>(null)
  useEffect(() => {
    if (!words || words.length === 0) return
    let outer: ReturnType<typeof setTimeout>
    const tick = () => {
      const w = words[Math.floor(Math.random() * words.length)] ?? null
      setFlash(w)
      const hold = setTimeout(() => setFlash(null), 1700)
      outer = setTimeout(tick, 6000 + Math.random() * 4000)
      return () => clearTimeout(hold)
    }
    outer = setTimeout(tick, 4000)
    return () => clearTimeout(outer)
  }, [words])
  return (
    <LinearGradient
      colors={lcd.case}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.case, { borderColor: lcd.caseBorder, borderBottomColor: lcd.caseEdge, shadowColor: lcd.caseShadow }]}
    >
      {/* ── LCD screen — tap to open the pet collection ── */}
      <Pressable style={[s.screen, { backgroundColor: lcd.screen, borderColor: lcd.screenEdge }]} onPress={onOpen}>
        <Svg style={StyleSheet.absoluteFill as object} width="100%" height="100%">
          <Defs>
            <Pattern id="lcdDots" width={7} height={7} patternUnits="userSpaceOnUse">
              <Rect width={1.4} height={1.4} fill={lcd.dot} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#lcdDots)" />
        </Svg>

        {/* coin counter, top-right */}
        <View style={s.coinRow}>
          <Text style={[s.coinNum, { fontFamily: fonts.pixel, color: lcd.ink }]}>{coins}</Text>
          <View style={[s.coin, { backgroundColor: lcd.track, borderColor: lcd.ink }]} />
        </View>

        {/* weekly earned / spent, top-left — LCD style */}
        <View style={s.weekWrap}>
          <Text style={[s.weekNum, { fontFamily: fonts.pixel, color: lcd.ink }]}>+{weeklyEarned.toLocaleString()}</Text>
          <Text style={[s.weekLabel, { fontFamily: fonts.pixel, color: lcd.inkDim }]}>{earnedLabel}</Text>
          <Text style={[s.weekNum, s.weekNumSpent, { fontFamily: fonts.pixel, color: lcd.inkDim }]}>-{weeklySpent.toLocaleString()}</Text>
          <Text style={[s.weekLabel, { fontFamily: fonts.pixel, color: lcd.inkDim }]}>{spentLabel}</Text>
        </View>

        {/* progress ring → next pet, pet sits inside; lifetime points below */}
        <View style={s.centerStack}>
          <View style={s.ringWrap}>
            <Svg width={132} height={132}>
              <Circle cx={66} cy={66} r={61} stroke={lcd.track} strokeWidth={8} fill="none" />
              <Circle
                cx={66}
                cy={66}
                r={61}
                stroke={lcd.ink}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={383.3}
                strokeDashoffset={383.3 * (1 - Math.max(0, Math.min(1, ringProgress)))}
                transform="rotate(-90 66 66)"
              />
            </Svg>
            <View style={s.ringPet}>
              <AyooPet petKey={petKey} streak={streak} pixelSize={5} walkRange={0} {...(lcd.petInk ? { ink: lcd.petInk } : {})} />
            </View>
          </View>

          {/* all-time earned points (gross — spends not subtracted) */}
          <Text style={[s.lifetimeNum, { fontFamily: fonts.pixel, color: lcd.ink }]} numberOfLines={1}>
            {lifetimePoints.toLocaleString()}
          </Text>
          <Text style={[s.lifetimeLabel, { fontFamily: fonts.pixel, color: lcd.inkDim }]}>ALL-TIME</Text>

          {/* pet name — sometimes the pet "speaks" a word (red, stays coloured) */}
          <Text
            style={[s.nameCaption, { fontFamily: fonts.pixel, color: lcd.ink }, flash ? s.captionFlash : null]}
            numberOfLines={1}
          >
            {flash ?? name}
          </Text>
        </View>

        {/* device status, bottom-right — STREAK / WELCOME / QUESTS */}
        {info && info.length > 0 ? (
          <View style={s.infoWrap}>
            {info.map((c) => (
              <View key={c.label} style={s.infoRow}>
                <Text style={[s.infoVal, { fontFamily: fonts.pixel, color: lcd.ink }]} numberOfLines={1}>{c.value}</Text>
                <Text style={[s.infoLab, { fontFamily: fonts.pixel, color: lcd.inkDim }]} numberOfLines={1}>{c.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  case: {
    borderRadius: 28,
    padding: 12,
    borderWidth: 1,
    borderBottomWidth: 3,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 6,
  },

  // ── LCD screen ──
  screen: {
    height: 244,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coinRow: {
    position: "absolute",
    top: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  coinNum: { fontSize: 26, lineHeight: 28 },
  weekWrap: { position: "absolute", top: 10, left: 12 },
  weekNum: { fontSize: 17 },
  weekNumSpent: { marginTop: 9 },
  weekLabel: { fontSize: 6, lineHeight: 9, marginTop: 3 },
  coin: {
    width: 22,
    height: 26,
    borderRadius: 5,
    borderWidth: 2,
  },
  // ── centre: progress ring + pet + all-time points ──
  centerStack: { alignItems: "center", justifyContent: "center" },
  ringWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  ringPet: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  lifetimeNum: { fontSize: 22, lineHeight: 24, marginTop: 8 },
  lifetimeLabel: { fontSize: 6, letterSpacing: 1, marginTop: 4 },
  nameCaption: { fontSize: 11, marginTop: 8 },
  captionFlash: { color: "#E23B22" },

  // device status, bottom-right corner
  infoWrap: { position: "absolute", bottom: 10, right: 12, alignItems: "flex-end", gap: 5 },
  infoRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  infoVal: { fontSize: 12, lineHeight: 14 },
  infoLab: { fontSize: 5, letterSpacing: 0.5 },
})
