import { useEffect, useRef } from "react"
import { Animated, Easing } from "react-native"
import Svg, { Path, G } from "react-native-svg"

// Animated face built from "Ресурс 7.svg" — an oval head with two eyes.
// Original artwork kept verbatim; each eye sits in nested <G>s we drive via the
// SVG transform: outer = gaze (look left/right), inner = blink (scale about its
// own center). viewBox 79.37 × 50.1 (ratio ~0.631).
const HEAD =
  "M23.64.59c8.75-.75,22.47-.76,31.25-.14,32.68,2.31,32.77,47.14-.47,49.25-8.5.54-20.95.54-29.45,0C-8.11,47.59-8.08,3.3,23.64.59Z"
const EYE_L = "M21.62,18.93c5.78-.95,7.93,8.76,3.07,11.55-7.36,4.23-10.54-10.33-3.07-11.55Z"
const EYE_R = "M44.05,18.92c5.78-.96,7.94,8.77,3.07,11.56-7.41,4.24-10.61-10.31-3.07-11.56Z"
const EYE_CY = 24.7 // vertical center of both eyes — blink scales about this line

const RATIO = 50.1 / 79.37
const AG = Animated.createAnimatedComponent(G)

const gazeXform = (gaze: Animated.Value) =>
  gaze.interpolate({ inputRange: [-1, 1], outputRange: ["translate(-2.4,0)", "translate(2.4,0)"] })

const lidXform = (lid: Animated.Value) =>
  lid.interpolate({
    inputRange: [0, 1],
    outputRange: [
      `translate(0,${EYE_CY}) scale(1,0.06) translate(0,${-EYE_CY})`,
      `translate(0,${EYE_CY}) scale(1,1) translate(0,${-EYE_CY})`,
    ],
  })

export function AyooFace({
  width = 110,
  height,
  head = "#2c2c2a",
  eyes = "#fff",
}: {
  width?: number
  height?: number
  head?: string
  eyes?: string
}) {
  const gaze = useRef(new Animated.Value(0)).current // -1 left .. +1 right
  const lidL = useRef(new Animated.Value(1)).current // 1 open .. 0 closed
  const lidR = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const look = (to: number) =>
      Animated.timing(gaze, { toValue: to, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: false })
    const blink = (lid: Animated.Value) =>
      Animated.sequence([
        Animated.timing(lid, { toValue: 0, duration: 80, useNativeDriver: false }),
        Animated.timing(lid, { toValue: 1, duration: 120, useNativeDriver: false }),
      ])

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        look(1), // glance right
        Animated.delay(550),
        Animated.parallel([blink(lidL), blink(lidR)]),
        look(-1), // glance left
        Animated.delay(550),
        look(0), // back to center
        Animated.delay(450),
        Animated.parallel([blink(lidL), blink(lidR)]),
        Animated.delay(800),
        blink(lidR), // wink
        Animated.delay(1500),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [gaze, lidL, lidR])

  return (
    <Svg width={width} height={height ?? Math.round(width * RATIO)} viewBox="0 0 79.37 50.1">
      <Path d={HEAD} fill={head} />
      <AG transform={gazeXform(gaze)}>
        <AG transform={lidXform(lidL)}>
          <Path d={EYE_L} fill={eyes} />
        </AG>
        <AG transform={lidXform(lidR)}>
          <Path d={EYE_R} fill={eyes} />
        </AG>
      </AG>
    </Svg>
  )
}
