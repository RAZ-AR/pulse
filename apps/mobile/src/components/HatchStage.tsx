/**
 * HatchStage — the onboarding "birth" scene shown on the device LCD.
 *
 *   ┌ LcdScreen ───────────────────┐
 *   │            +120 / 500         │  ← welcome points fed so far
 *   │             ▒ 🥚 ▒            │  ← egg shakes; hatches at goal
 *   │             TAP +             │
 *   └───────────────────────────────┘
 *
 * Controlled: parent owns `fed` (incremented by the big green + key) and the
 * goal (500 welcome points). When fed reaches goal the egg plays a one-shot
 * hatch sequence (hard shake → scanline flash → EGG swaps to HATCHLING → "HI")
 * and calls `onHatched` once.
 *
 * Pure presentational otherwise — no data fetching.
 */

import { useEffect, useRef, useState } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"
import { LcdScreen } from "./console"
import { PixelSprite, PET_SPRITES } from "./AyooPet"
import { fonts } from "../lib/theme"

const EGG = PET_SPRITES.EGG!
const HATCHLING = PET_SPRITES.HATCHLING!
const HATCH_GREEN = "#4FB286"

export function HatchStage({
  fed,
  goal,
  hatchWord = "HI",
  tapHint = "TAP +",
  onHatched,
}: {
  fed: number
  goal: number
  hatchWord?: string
  tapHint?: string
  onHatched?: () => void
}) {
  const hatched = fed >= goal
  const shown = Math.min(fed, goal)

  // Idle frame toggle (gives the sprite its 2-frame life).
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 460)
    return () => clearInterval(id)
  }, [])

  // Gentle idle shake while still an egg; a sharp wobble on each feed tap.
  const shake = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (hatched) return
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }, [fed, hatched, shake])

  // One-shot hatch: scanline sweep + sprite pop, fired when `hatched` flips true.
  const scan = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(1)).current
  const [flash, setFlash] = useState(false)
  const fired = useRef(false)
  useEffect(() => {
    if (!hatched || fired.current) return
    fired.current = true
    setFlash(true)
    Animated.parallel([
      Animated.timing(scan, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.45, duration: 140, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
    ]).start()
    onHatched?.()
    const t = setTimeout(() => setFlash(false), 1800)
    return () => clearTimeout(t)
  }, [hatched, scan, pop, onHatched])

  const rows = hatched ? HATCHLING : EGG
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] })

  return (
    <LcdScreen accent={HATCH_GREEN}>
      {/* counter */}
      <Text style={[s.counter, { fontFamily: fonts.pixel }]}>
        +{shown} / {goal}
      </Text>

      {/* egg / hatchling */}
      <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: pop }] }}>
        <PixelSprite rows={rows[frame] ?? rows[0]} px={9} />
      </Animated.View>

      {/* hint / hatch word */}
      <Text style={[s.hint, { fontFamily: fonts.pixel }, flash && s.hintFlash]}>
        {hatched ? hatchWord : tapHint}
      </Text>

      {/* scanline sweep on hatch */}
      {hatched ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.scanline,
            {
              opacity: scan.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.85, 0.85, 0] }),
              transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] }) }],
            },
          ]}
        />
      ) : null}
    </LcdScreen>
  )
}

const s = StyleSheet.create({
  counter: { fontSize: 13, color: "#3E8E6E", letterSpacing: 1 },
  hint: { fontSize: 9, color: "#8C887E", letterSpacing: 1, marginTop: 4 },
  hintFlash: { color: "#f2a66e" },
  scanline: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
})
