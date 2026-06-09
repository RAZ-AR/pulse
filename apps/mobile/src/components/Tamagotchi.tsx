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
import Svg, { Defs, Pattern, Rect } from "react-native-svg"
import { fonts } from "../lib/theme"
import { AyooPet } from "./AyooPet"

// ── LCD palette ────────────────────────────────────────────────
const LCD = {
  case:        "#9AA886",
  caseEdge:    "#828F6C",
  caseBorder:  "#5F6B49",
  screen:      "#A9B795",
  screenEdge:  "#7E8C68",
  dot:         "#93A17C",
  ink:         "#2A3322",
  inkDim:      "#5E6A48",
  track:       "#8E9C78",
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
    <View style={s.case}>
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
    </View>
  )
}

const s = StyleSheet.create({
  case: {
    borderRadius: 24,
    padding: 12,
    backgroundColor: LCD.case,
    borderWidth: 2,
    borderColor: LCD.caseBorder,
    borderBottomWidth: 5,
    gap: 10,
    shadowColor: "#5F6B49",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },

  // ── stat bars ──
  statsBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: LCD.caseEdge,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statCol: { flex: 1, alignItems: "center", gap: 4 },
  statLabel: { fontSize: 7, letterSpacing: 0.3, color: LCD.ink },
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
