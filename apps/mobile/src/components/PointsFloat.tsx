/**
 * Floating points animation. Watches the user's balance and, whenever it
 * changes, floats a "+N" (earn) or "−N" (spend) that rises and fades —
 * wherever the user currently is. Mounted once globally in the root layout.
 */
import { useEffect, useRef, useState } from "react"
import { Animated, Platform, StyleSheet, Text, View } from "react-native"
import { trpc } from "../lib/trpc"
import { useAuth } from "../store/auth"
import { fonts } from "../lib/theme"

type Pop = { id: number; delta: number }

export function PointsFloat() {
  const { token } = useAuth()
  const me = trpc.user.me.useQuery(undefined, { enabled: !!token })
  const total = (me.data?.earnedPoints ?? 0) + (me.data?.welcomePoints ?? 0)

  const prev = useRef<number | null>(null)
  const [pop, setPop] = useState<Pop | null>(null)
  const anim = useRef(new Animated.Value(0)).current
  const seq = useRef(0)

  useEffect(() => {
    if (!me.data) return
    if (prev.current === null) { prev.current = total; return }
    const delta = total - prev.current
    prev.current = total
    if (delta === 0) return

    seq.current += 1
    setPop({ id: seq.current, delta })
    anim.setValue(0)
    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== "web" }).start(() => {
      setPop((p) => (p && p.id === seq.current ? null : p))
    })
  }, [total, me.data, anim])

  if (!pop) return null

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, -78] })
  const opacity = anim.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 1, 0] })
  const scale = anim.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.6, 1.12, 1] })
  const earn = pop.delta > 0
  const sign = earn ? "+" : "−"

  const wrap = Platform.OS === "web"
    ? [s.wrap, { position: "fixed" as "absolute" }]
    : s.wrap

  return (
    <View pointerEvents="none" style={wrap}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <View style={[s.pill, earn ? s.pillEarn : s.pillSpend]}>
          <Text style={[s.text, { color: earn ? "#3E8E5E" : "#C25A37", fontFamily: fonts.displayHeavy }]}>
            {sign}{Math.abs(pop.delta).toLocaleString()}
          </Text>
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 96,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2000,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 10,
  },
  pillEarn: { backgroundColor: "#EBF6EE", borderTopColor: "rgba(255,255,255,0.95)", borderBottomColor: "rgba(70,140,90,0.3)" },
  pillSpend: { backgroundColor: "#FBEADC", borderTopColor: "rgba(255,255,255,0.95)", borderBottomColor: "rgba(180,90,55,0.3)" },
  text: { fontSize: 22, letterSpacing: 0.5 },
})
