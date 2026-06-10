import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native"
import { fonts } from "../lib/theme"

// ── Pixel palette ─────────────────────────────────────────────
// Classic Tamagotchi LCD look: black line-art on the stage tint that shows
// through the transparent interior. Pure monochrome — just outline + dots.
const C: Record<string, string> = {
  ".": "transparent",
  K: "#1A1208", // near-black ink outline
}

// ── Sprites: 14×14 grid, 2 frames each ────────────────────────
type SpriteFrames = [string[], string[]]

// Frame alternation gives the idle animation feel. Keyed by shared stage `key`.
export const PET_SPRITES: Record<string, SpriteFrames> = {
  // Egg — wobbles, crack jitters side to side.
  EGG: [
    [
      ".....KKKK.....",
      "...KK....KK...",
      "..K........K..",
      ".K..........K.",
      ".K..........K.",
      "K............K",
      "K....KKK.....K",
      "K...K...K....K",
      "K............K",
      "K............K",
      ".K..........K.",
      ".K..........K.",
      "..KK......KK..",
      "....KKKKKK....",
    ],
    [
      ".....KKKK.....",
      "...KK....KK...",
      "..K........K..",
      ".K..........K.",
      ".K..........K.",
      "K............K",
      "K.....KKK....K",
      "K....K...K...K",
      "K............K",
      "K............K",
      ".K..........K.",
      ".K..........K.",
      "..KK......KK..",
      "....KKKKKK....",
    ],
  ],

  // Chick — little bird that hops up and flaps its stubs.
  HATCHLING: [
    [
      "..............",
      "....KKKKKK....",
      "..KK......KK..",
      ".K..........K.",
      ".K..K..K....K.",
      "K............K",
      "K.....KK.....K",
      "K............K",
      ".K..........K.",
      "..KK......KK..",
      "....KKKKKK....",
      "....K....K....",
      "...KK....KK...",
      "..............",
    ],
    [
      "....KKKKKK....",
      "..KK......KK..",
      ".K..........K.",
      ".K..K..K....K.",
      "K............K",
      "K.....KK.....K",
      "KK..........KK",
      ".K..........K.",
      "..KK......KK..",
      "....KKKKKK....",
      ".....K..K.....",
      "..............",
      "..............",
      "..............",
    ],
  ],

  // Bunny — tall ears twitch, eyes blink, feet shuffle.
  KID: [
    [
      "...K......K...",
      "...K......K...",
      "...K......K...",
      "..KKK....KKK..",
      ".K..........K.",
      ".K..K....K..K.",
      ".K..........K.",
      ".K...KKKK...K.",
      "..K........K..",
      "..K........K..",
      "...KK....KK...",
      "....KK..KK....",
      "..............",
      "..............",
    ],
    [
      "....K....K....",
      "...K......K...",
      "...K......K...",
      "..KKK....KKK..",
      ".K..........K.",
      ".K..KK..KK..K.",
      ".K..........K.",
      ".K...KKKK...K.",
      "..K........K..",
      "..K........K..",
      "...KK....KK...",
      "...KK......KK.",
      "..............",
      "..............",
    ],
  ],

  // Fox — pointed ears, four legs that alternate as it trots.
  FOX: [
    [
      ".KK......KK...",
      "K..K....K..K..",
      "K...KKKK...K..",
      "K..........K..",
      "K..K....K..K..",
      "K..........K..",
      "K....KK....K..",
      ".K........K...",
      ".K........K...",
      ".KKKKKKKKKK...",
      "..K..KK..K....",
      "..K..KK..K....",
      ".KK..KK..KK...",
      "..............",
    ],
    [
      "..KK....KK....",
      ".K..K..K..K...",
      "K...KKKK...K..",
      "K..........K..",
      "K..K....K..K..",
      "K..........K..",
      "K....KK....K..",
      ".K........K...",
      ".K........K...",
      ".KKKKKKKKKK...",
      "...K..KK..K...",
      "...K..KK..K...",
      "..KK..KK..KK..",
      "..............",
    ],
  ],

  // Dragon — horns, eyes, wings that flap from up to mid.
  DRAGON: [
    [
      "..K......K....",
      "..KK....KK....",
      ".KKKKKKKKKK...",
      "K..........K..",
      "K..KK..KK..K..",
      "K..........K..",
      "K....KK....K..",
      ".K........K...",
      "KKK......KKK..",
      ".KKKKKKKKKK...",
      "..K..KK..K....",
      ".KK..KK..KK...",
      "..............",
      "..............",
    ],
    [
      "..K......K....",
      "..KK....KK....",
      ".KKKKKKKKKK...",
      "K..........K..",
      "K..KK..KK..K..",
      "K..........K..",
      "K....KK....K..",
      "KK........KK..",
      ".KK......KK...",
      ".KKKKKKKKKK...",
      "...K..KK..K...",
      "..KK..KK..KK..",
      "..............",
      "..............",
    ],
  ],

  // Phoenix — crest, big wings beating up then down, tail flames flick.
  PHOENIX: [
    [
      "....K..K......",
      ".....KK.......",
      "K...KKKK...K..",
      ".K.KKKKKK.K...",
      "..KK....KK....",
      ".K..K..K..K...",
      ".K........K...",
      ".K...KK...K...",
      "..KK....KK....",
      "...KKKKKK.....",
      "....K..K......",
      "...K....K.....",
      "..KK....KK....",
      "..............",
    ],
    [
      "....K..K......",
      ".....KK.......",
      "..KK....KK....",
      ".KKKKKKKKKK...",
      "K..K....K..K..",
      "K..........K..",
      "K....KK....K..",
      ".KK......KK...",
      "KK........KK..",
      "...KKKKKK.....",
      "....K..K......",
      "..KK....KK....",
      ".K..K..K..K...",
      "..............",
    ],
  ],
}

// ── Pixel sprite renderer ─────────────────────────────────────
// Renders a pixel sprite. `px` controls pixel size.
export function PixelSprite({ rows, px = 5 }: { rows: string[]; px?: number }) {
  return (
    <View style={{ gap: 0 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row" }}>
          {row.split("").map((ch, ci) => (
            <View
              key={ci}
              style={{ width: px, height: px, backgroundColor: C[ch] ?? "transparent" }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

// ── Small collected-pet icon (static, no animation) ───────────
export function PetIcon({ petKey, px = 3 }: { petKey: string; px?: number }) {
  const frames = PET_SPRITES[petKey] ?? PET_SPRITES.HATCHLING!
  return <PixelSprite rows={frames[0]} px={px} />
}

// ── The current pet: big, animated, roams the habitat ─────────
type Props = {
  petKey: string
  streak: number
  petName?: string | null | undefined
  onPress?: (() => void) | undefined
  pixelSize?: number | undefined
  walkRange?: number | undefined
}

export function AyooPet({ petKey, streak, petName, onPress, pixelSize = 6, walkRange = 60 }: Props) {
  const frames = PET_SPRITES[petKey] ?? PET_SPRITES.HATCHLING!

  // Frame toggle for idle animation
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 500)
    return () => clearInterval(id)
  }, [petKey])

  // The frame is static. The sprite inside walks and jumps like a tiny toy.
  const walkAnim = useRef(new Animated.Value(-1)).current
  const hopAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const walk = Animated.loop(
      Animated.sequence([
        Animated.timing(walkAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(walkAnim, { toValue: -1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    )
    const hop = Animated.loop(
      Animated.sequence([
        Animated.timing(hopAnim, { toValue: -1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(hopAnim, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.delay(520),
      ])
    )
    walk.start()
    hop.start()
    return () => {
      walk.stop()
      hop.stop()
    }
  }, [petKey])

  // Hunger shake
  const shakeAnim = useRef(new Animated.Value(0)).current
  const isHungry = streak === 0
  useEffect(() => {
    if (!isHungry) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 3,  duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: -3, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: false }),
        Animated.delay(2500),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isHungry])

  // Tap bounce
  const tapScale = useRef(new Animated.Value(1)).current
  function onTap(e?: { stopPropagation?: () => void }) {
    // Keep the tap on the pet — don't let it bubble to a parent (e.g. the
    // tamagotchi screen that opens the collection). Tapping the pet only jumps.
    e?.stopPropagation?.()
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 1.4, duration: 100, useNativeDriver: false }),
      Animated.spring(tapScale,  { toValue: 1,  friction: 3,   useNativeDriver: false }),
    ]).start()
    onPress?.()
  }

  const petTranslateX = Animated.add(
    walkAnim.interpolate({ inputRange: [-1, 1], outputRange: [-walkRange, walkRange] }),
    shakeAnim
  )
  const petTranslateY = hopAnim.interpolate({ inputRange: [-1, 0], outputRange: [-10, 0] })

  return (
    <View style={p.wrap}>
      <Pressable onPress={onTap}>
        <View style={p.box}>
          <Animated.View
            style={[
              p.spriteStage,
              { transform: [{ translateX: petTranslateX }, { translateY: petTranslateY }, { scale: tapScale }] },
            ]}
          >
            <PixelSprite rows={frames[frame] ?? frames[0]} px={pixelSize} />
          </Animated.View>
          {isHungry && <View style={p.hungryDot} />}
        </View>
      </Pressable>

      {petName ? (
        <Text style={[p.petName, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {petName.toUpperCase()}
        </Text>
      ) : null}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────
const p = StyleSheet.create({
  wrap: { alignItems: "center", gap: 5 },

  box: {
    // Transparent habitat — no frame, no fill. Pet roams over the card.
    width: 264,
    height: 144,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  spriteStage: { alignItems: "center", justifyContent: "center" },

  hungryDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ea5b0c",
    borderWidth: 1,
    borderColor: "#000",
  },

  petName: {
    fontSize: 8,
    letterSpacing: 0.8,
    color: "rgba(0,0,0,0.6)",
    maxWidth: 60,
  },

  barWrap: { width: 50 },
  barTrack: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: "#000",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#273AA8",
  },
})
