/**
 * ComicBubble — a small pixel-styled speech bubble that pops in, holds, then
 * fades. Bump `trigger` (any changing number) to replay the pop-in/fade
 * sequence with the given `text` — used to react to taps and milestones
 * during onboarding so those moments feel alive, not just numeric.
 */
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from "react-native"
import { fonts } from "../lib/theme"

const INK = "#1A1208"
const FILL = "#F6F6F3"

// Neutral, universally-readable reactions — no slang, so they read fine
// regardless of which language the rest of the onboarding UI is in.
export const REACTION_WORDS = ["WOW", "BOOM", "COOL", "YEAH", "HI"]

export function ComicBubble({
  text,
  trigger,
  tint = INK,
  style,
}: {
  text: string
  trigger: number
  tint?: string
  style?: ViewStyle
}) {
  const [visible, setVisible] = useState(false)
  const scale = useRef(new Animated.Value(0.4)).current
  const rise = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (trigger <= 0) return
    setVisible(true)
    scale.setValue(0.4)
    rise.setValue(0)
    opacity.setValue(1)
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 120, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start()
    Animated.timing(rise, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
    const fade = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setVisible(false))
    }, 550)
    return () => clearTimeout(fade)
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -22] })

  return (
    <Animated.View pointerEvents="none" style={[s.wrap, style, { opacity, transform: [{ translateY }, { scale }] }]}>
      <View style={[s.bubble, { borderColor: tint }]}>
        <Text style={[s.text, { fontFamily: fonts.pixel, color: tint }]}>{text}</Text>
      </View>
      <View style={[s.tailOuter, { borderTopColor: tint }]} />
      <View style={s.tailInner} />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 10 },
  bubble: {
    backgroundColor: FILL,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { fontSize: 13, letterSpacing: 1 },
  tailOuter: {
    position: "absolute", bottom: -8, left: 14,
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  tailInner: {
    position: "absolute", bottom: -5, left: 16,
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: FILL,
  },
})
