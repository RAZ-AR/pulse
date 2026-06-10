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

import { StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Defs, Pattern, Rect } from "react-native-svg"
import { fonts } from "../lib/theme"
import { AyooPet } from "./AyooPet"

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
  caption,
  stats,
  onPress,
}: {
  petKey: string
  streak: number
  petName?: string | null | undefined
  coins: number
  caption: string
  stats: Stat[]
  onPress?: (() => void) | undefined
}) {
  return (
    <LinearGradient colors={CASE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.case}>
      {/* ── Status bars ── */}
      <View style={s.statsBox}>
        {stats.map((stat) => (
          <View key={stat.label} style={s.statCol}>
            <Text style={[s.statLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
              {stat.label}
            </Text>
            <View style={s.statTrack}>
              <View style={[s.statFill, { width: `${Math.round(Math.max(0, Math.min(1, stat.value)) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* ── LCD screen ── */}
      <View style={s.screen}>
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
          <Text style={[s.coinNum, { fontFamily: fonts.displayHeavy }]}>{coins}</Text>
          <View style={s.coin} />
        </View>

        {/* the pet roams the screen */}
        <View style={s.petStage}>
          <AyooPet
            petKey={petKey}
            streak={streak}
            pixelSize={6}
            walkRange={46}
            onPress={onPress}
          />
        </View>

        {/* name / tier caption */}
        <Text style={[s.caption, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>
          {(petName || caption).toUpperCase()}
        </Text>
      </View>
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
    shadowColor: "#A3B1C6",
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
  statCol: { flex: 1, alignItems: "center", gap: 4 },
  statLabel: { fontSize: 7, letterSpacing: 0.3, color: LCD.inkDim },
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
  coinNum: { fontSize: 18, color: LCD.ink, letterSpacing: 0.5 },
  coin: {
    width: 14,
    height: 16,
    borderRadius: 3,
    backgroundColor: LCD.track,
    borderWidth: 2,
    borderColor: LCD.ink,
  },
  petStage: { alignItems: "center", justifyContent: "center" },
  caption: {
    position: "absolute",
    bottom: 12,
    fontSize: 20,
    color: LCD.ink,
    letterSpacing: 1,
  },
})
