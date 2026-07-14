/**
 * HatchStage — the onboarding "birth" scene shown on the device LCD (light screen).
 *
 *   ┌ LcdScreen (light) ────────────┐
 *   │            +300 / 500          │  ← animated count-up, "+100" floats up
 *   │             ▒ 🥚 ▒            │  ← egg cracks more each tap
 *   │             TAP               │
 *   └───────────────────────────────┘
 *
 * Controlled: parent owns `fed` (+100 per tap). The egg shows 5 crack stages
 * over the first 4 taps; on the 5th tap (fed === goal) it hatches into the
 * HATCHLING with a pop + "HI", and the parent swaps the dot key for an arrow.
 */

import { useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, Text, View } from "react-native"
import { LcdScreen } from "./console"
import { PixelSprite, PET_SPRITES } from "./AyooPet"
import { ComicBubble, REACTION_WORDS, StarBurst } from "./ComicBubble"
import { fonts } from "../lib/theme"

const HATCHLING = PET_SPRITES.HATCHLING!
const HATCH_GREEN = "#015634"

// Egg with progressively more cracks (0 = whole … 4 = about to hatch).
const EGG_STAGES: string[][] = [
  ["..KKKK..", ".KKKKKK.", "KKKKKKKK", "KKKKKKKK", "KKKKKKKK", "KKKKKKKK", ".KKKKKK.", "..KKKK.."],
  ["..KKKK..", ".KKKKKK.", "KKKKKKKK", "KKK..KKK", "KKKKKKKK", "KKKKKKKK", ".KKKKKK.", "..KKKK.."],
  ["..KKKK..", ".KKKKKK.", "KKKK.KKK", "KKK..KKK", "KKKK.KKK", "KKKKKKKK", ".KKKKKK.", "..KKKK.."],
  ["..KKKK..", ".KKK.KK.", "KKKK.KKK", "KKK..KKK", "KKK.KKKK", "KKKK.KKK", ".KKKKKK.", "..KKKK.."],
  ["..KK.K..", ".KK.KK..", "KKK.KKKK", "KK..K.KK", "KK.KK.KK", "KKK.KKKK", ".KK.KKK.", "..KKKK.."],
]

export function HatchStage({
  fed,
  goal,
  hatchWord = "HI",
  tapHint = "TAP",
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
  const crack = Math.min(EGG_STAGES.length - 1, Math.floor(fed / 100))

  // Idle frame toggle (gives the sprite its 2-frame life).
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 460)
    return () => clearInterval(id)
  }, [])

  // Animated count-up of the welcome points.
  const [displayed, setDisplayed] = useState(0)
  const count = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const id = count.addListener(({ value }) => setDisplayed(Math.round(value)))
    return () => count.removeListener(id)
  }, [count])
  useEffect(() => {
    Animated.timing(count, { toValue: shown, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [shown, count])

  // On each feed tap: counter pop, a comic "+100" bubble, a cycling reaction
  // word, the egg wobbles.
  const pop = useRef(new Animated.Value(1)).current
  const shake = useRef(new Animated.Value(0)).current
  const prev = useRef(fed)
  useEffect(() => {
    if (fed > prev.current) {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.18, duration: 110, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start()
      if (!hatched) {
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
        ]).start()
      }
    }
    prev.current = fed
  }, [fed, hatched, pop, shake])
  const reactionWord = REACTION_WORDS[Math.floor(fed / 100) % REACTION_WORDS.length]!

  // One-shot hatch: sprite pop + a flashing greeting word + a star burst.
  const hatchPop = useRef(new Animated.Value(1)).current
  const [flash, setFlash] = useState(false)
  const [hatchBurst, setHatchBurst] = useState(0)
  const fired = useRef(false)
  useEffect(() => {
    if (!hatched || fired.current) return
    fired.current = true
    setFlash(true)
    setHatchBurst((n) => n + 1)
    Animated.sequence([
      Animated.timing(hatchPop, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.spring(hatchPop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start()
    onHatched?.()
    const t = setTimeout(() => setFlash(false), 1800)
    return () => clearTimeout(t)
  }, [hatched, hatchPop, onHatched])

  const spriteRows = hatched ? (HATCHLING[frame] ?? HATCHLING[0]!) : EGG_STAGES[crack]!
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] })

  return (
    <LcdScreen accent={HATCH_GREEN} dark={false}>
      {/* counter — animated, with a comic "+100" burst + a reaction word each tap */}
      <View style={s.counterRow}>
        <Animated.Text style={[s.counter, { fontFamily: fonts.pixel, transform: [{ scale: pop }] }]}>
          +{displayed} / {goal}
        </Animated.Text>
        {!hatched ? (
          <>
            <ComicBubble text="+100" trigger={fed} tint={HATCH_GREEN} style={s.bubblePoints} />
            <ComicBubble text={reactionWord} trigger={fed} tint={HATCH_GREEN} style={s.bubbleWord} />
          </>
        ) : null}
      </View>

      {/* egg (cracks each tap) / hatchling */}
      <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: hatchPop }] }}>
        <PixelSprite rows={spriteRows} px={9} />
      </Animated.View>
      <StarBurst trigger={hatchBurst} count={7} radius={46} tint={HATCH_GREEN} />

      <Text style={[s.hint, { fontFamily: fonts.pixel }, flash && s.hintFlash]}>
        {hatched ? hatchWord : tapHint}
      </Text>
    </LcdScreen>
  )
}

const s = StyleSheet.create({
  counterRow: { alignItems: "center", justifyContent: "center", minHeight: 22 },
  counter: { fontSize: 15, color: HATCH_GREEN, letterSpacing: 1 },
  bubblePoints: { top: -6, left: "50%", marginLeft: -34 },
  bubbleWord: { top: 26, right: -10 },
  hint: { fontSize: 9, color: "#8C887E", letterSpacing: 1, marginTop: 4 },
  hintFlash: { color: "#fd4600" },
})
