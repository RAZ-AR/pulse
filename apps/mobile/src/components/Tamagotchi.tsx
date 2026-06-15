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
 */

import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Defs, Pattern, Rect } from "react-native-svg"
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

// ── LCD palette — light device, neutral grey screen ────────────
const CASE_GRADIENT = ["#FFFFFF", "#E9EDF4"] as const
const LCD = {
  caseBorder:  "rgba(255,255,255,0.9)",
  caseEdge:    "#D7DCE6",
  screen:      "#DBDBDB",
  screenEdge:  "#C4C4C4",
  dot:         "#CBCBCB",
  ink:         "#3A3F47",
  inkDim:      "#9AA0AB",
  track:       "#CFCFCF",
}

export type Stat = { label: string; value: number }

export function TamagotchiWindow({
  petKey,
  streak,
  petName,
  coins,
  stats,
  weeklyEarned,
  weeklySpent,
  earnedLabel,
  spentLabel,
  words,
  onOpen,
}: {
  petKey: string
  streak: number
  petName?: string | null | undefined
  coins: number
  stats: Stat[]
  weeklyEarned: number
  weeklySpent: number
  earnedLabel: string
  spentLabel: string
  words?: string[] | undefined
  onOpen?: (() => void) | undefined
}) {
  const name = (petName?.trim() || petDefaultName(petKey))

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
    <LinearGradient colors={CASE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.case}>
      {/* ── Status bars ── */}
      <View style={s.statsBox}>
        {stats.map((stat) => (
          <View key={stat.label} style={s.statCol}>
            <Text style={[s.statLabel, { fontFamily: fonts.pixel }]} numberOfLines={1} adjustsFontSizeToFit>
              {stat.label}
            </Text>
            <View style={s.statTrack}>
              <View style={[s.statFill, { width: `${Math.round(Math.max(0, Math.min(1, stat.value)) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* ── LCD screen — tap to open the pet collection ── */}
      <Pressable style={s.screen} onPress={onOpen}>
        <Svg style={StyleSheet.absoluteFill as object} width="100%" height="100%">
          <Defs>
            <Pattern id="lcdDots" width={7} height={7} patternUnits="userSpaceOnUse">
              <Rect width={1.4} height={1.4} fill={LCD.dot} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#lcdDots)" />
        </Svg>

        {/* coin counter, top-right */}
        <View style={s.coinRow}>
          <Text style={[s.coinNum, { fontFamily: fonts.pixel }]}>{coins}</Text>
          <View style={s.coin} />
        </View>

        {/* weekly earned / spent, top-left — LCD style */}
        <View style={s.weekWrap}>
          <Text style={[s.weekNum, { fontFamily: fonts.pixel }]}>+{weeklyEarned.toLocaleString()}</Text>
          <Text style={[s.weekLabel, { fontFamily: fonts.pixel }]}>{earnedLabel}</Text>
          <Text style={[s.weekNum, s.weekNumSpent, { fontFamily: fonts.pixel }]}>-{weeklySpent.toLocaleString()}</Text>
          <Text style={[s.weekLabel, { fontFamily: fonts.pixel }]}>{spentLabel}</Text>
        </View>

        {/* the pet roams the screen — tapping it makes it jump (no navigation) */}
        <View style={s.petStage}>
          <AyooPet petKey={petKey} streak={streak} pixelSize={6} walkRange={46} />
        </View>

        {/* pet name caption — sometimes the pet "speaks" a word */}
        <Text style={[s.caption, { fontFamily: fonts.pixel }, flash ? s.captionFlash : null]} numberOfLines={1}>
          {flash ?? name}
        </Text>
      </Pressable>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  case: {
    borderRadius: 28,
    padding: 12,
    borderWidth: 1,
    borderColor: LCD.caseBorder,
    borderBottomWidth: 3,
    borderBottomColor: LCD.caseEdge,
    gap: 10,
    shadowColor: "#C9C4B4",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },

  // ── stat bars ──
  statsBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LCD.caseEdge,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  statCol: { flex: 1, alignItems: "center", gap: 5 },
  statLabel: { fontSize: 5, letterSpacing: 0, color: LCD.inkDim, textAlign: "center" },
  statTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: LCD.track,
    borderWidth: 1,
    borderColor: LCD.caseEdge,
    overflow: "hidden",
  },
  statFill: { height: "100%", backgroundColor: LCD.ink },

  // ── LCD screen ──
  screen: {
    height: 220,
    borderRadius: 16,
    backgroundColor: LCD.screen,
    borderWidth: 2,
    borderColor: LCD.screenEdge,
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
    gap: 5,
  },
  coinNum: { fontSize: 13, color: LCD.ink },
  weekWrap: { position: "absolute", top: 10, left: 12 },
  weekNum: { fontSize: 11, color: LCD.ink },
  weekNumSpent: { color: LCD.inkDim, marginTop: 7 },
  weekLabel: { fontSize: 5, lineHeight: 8, color: LCD.inkDim, marginTop: 3 },
  coin: {
    width: 13,
    height: 15,
    borderRadius: 3,
    backgroundColor: LCD.track,
    borderWidth: 2,
    borderColor: LCD.ink,
  },
  petStage: { alignItems: "center", justifyContent: "center" },
  caption: {
    position: "absolute",
    bottom: 14,
    fontSize: 12,
    color: LCD.ink,
  },
  captionFlash: { color: "#fd4600" },
})
