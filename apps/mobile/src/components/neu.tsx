/**
 * Neumorphic primitives: NeuCard, NeuInset, GradPill.
 *
 * RN can't do CSS-style multi-direction or inset shadows, so we approximate:
 * - NeuCard raised: single dark shadow bottom-right with a 1px highlight rim on top.
 * - NeuInset: a darker bg + subtle top/left dim for "pressed" feel.
 * - Gradient cards: LinearGradient + softer purple glow.
 */
import { Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { useEffect, useRef } from "react"
import { LinearGradient } from "expo-linear-gradient"
import { gradients, radius, useTheme } from "../lib/theme"

type GradientTuple = readonly [string, string, ...string[]]

type NeuCardProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: (() => void) | undefined
  gradient?: GradientTuple | undefined
  small?: boolean | undefined
  disabled?: boolean | undefined
}

export function NeuCard({ children, style, onPress, gradient, small, disabled }: NeuCardProps) {
  const theme = useTheme()
  const shadow = gradient ? theme.shadowGlow : small ? theme.shadowRaisedSm : theme.shadowRaised
  const r = small ? radius.sm : radius.md

  // Highlight rim approximates the top-left light source on neumorphic surfaces.
  // We lift it onto a wrapping View so it doesn't fight with the gradient's own shadow.
  const wrapperStyle: ViewStyle = {
    borderRadius: r,
    backgroundColor: gradient ? "transparent" : theme.surface,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: "rgba(255,255,255,0.9)",
    borderLeftColor: "rgba(255,255,255,0.85)",
    borderRightColor: "rgba(5,6,10,0.04)",
    borderBottomColor: "rgba(5,6,10,0.05)",
    ...shadow,
  }

  const Inner = gradient ? (
    <LinearGradient
      colors={gradient as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: r, overflow: "hidden" }, style]}
    >
      {children}
    </LinearGradient>
  ) : (
    <View style={[{ borderRadius: r, backgroundColor: theme.surface, overflow: "hidden" }, style]}>
      {children}
    </View>
  )

  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [wrapperStyle, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>
        {Inner}
      </Pressable>
    )
  }
  return <View style={wrapperStyle}>{Inner}</View>
}

// ── Inset (pressed) — for inputs ──────────────────────────────
type NeuInsetProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}
export function NeuInset({ children, style }: NeuInsetProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: "rgba(0,0,0,0.04)",
          borderRadius: radius.sm,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderTopColor: "rgba(163,160,200,0.35)",
          borderLeftColor: "rgba(163,160,200,0.25)",
          borderBottomWidth: 1,
          borderRightWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.7)",
          borderRightColor: "rgba(255,255,255,0.6)",
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

// ── Gradient pill ────────────────────────────────────────────
type GradPillProps = {
  label: string
  gradient?: GradientTuple
  style?: StyleProp<ViewStyle>
}
export function GradPill({ label, gradient, style }: GradPillProps) {
  return (
    <LinearGradient
      colors={(gradient ?? (["#FFB3E6", "#B8A9FF", "#89D4FF", "#9DFFDB"] as const)) as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.pill, style]}
    >
      <PillLabel label={label} />
    </LinearGradient>
  )
}

type LavaLampSurfaceProps = {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  intensity?: "solid" | "glass"
}

export function LavaLampSurface({
  children,
  style,
  contentStyle,
  intensity = "solid",
}: LavaLampSurfaceProps) {
  const spin = useRef(new Animated.Value(0)).current
  const drift = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 22000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift, {
            toValue: 1,
            duration: 11000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(drift, {
            toValue: 0,
            duration: 11000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [drift, spin])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })
  const moveA = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 20] })
  const moveB = drift.interpolate({ inputRange: [0, 1], outputRange: [16, -22] })
  const colors =
    intensity === "glass"
      ? gradients.lavaGlass
      : gradients.lava

  return (
    <View style={[s.lavaRoot, style]}>
      <LinearGradient
        colors={colors as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.lavaBlob,
          s.lavaBlobPink,
          { transform: [{ translateX: moveA }, { translateY: moveB }, { rotate }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.lavaBlob,
          s.lavaBlobBlue,
          { transform: [{ translateX: moveB }, { translateY: moveA }, { rotate }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.lavaBlob,
          s.lavaBlobLime,
          { transform: [{ translateX: moveA }, { translateY: moveA }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.lavaBlob,
          s.lavaBlobSalmon,
          { transform: [{ translateX: moveB }, { translateY: moveB }, { rotate }] },
        ]}
      />
      <View pointerEvents="none" style={s.lavaFrost} />
      <View pointerEvents="none" style={s.lavaSheen} />
      <View style={contentStyle}>{children}</View>
    </View>
  )
}

import { Text } from "react-native"
function PillLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        textShadowColor: "rgba(0,0,0,0.15)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      }}
    >
      {label}
    </Text>
  )
}

const s = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  lavaRoot: {
    overflow: "hidden",
    backgroundColor: "#F9FBFF",
  },
  lavaBlob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.34,
  },
  lavaBlobPink: {
    left: -74,
    top: -88,
    backgroundColor: "#F199E3",
  },
  lavaBlobBlue: {
    right: -82,
    top: -54,
    backgroundColor: "#85F5F2",
  },
  lavaBlobLime: {
    right: 12,
    bottom: -116,
    backgroundColor: "#9FEED3",
  },
  lavaBlobSalmon: {
    left: -42,
    bottom: -118,
    backgroundColor: "#D9E1FF",
  },
  lavaFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  lavaSheen: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
})
