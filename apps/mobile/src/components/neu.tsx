/**
 * Neumorphic primitives: NeuCard, NeuInset, GradPill, VolumeGradient.
 *
 * RN can't do CSS-style multi-direction or inset shadows, so we approximate:
 * - NeuCard raised: single dark shadow bottom-right with a 1px highlight rim on top.
 * - NeuInset: a darker bg + subtle top/left dim for "pressed" feel.
 * - Gradient cards: LinearGradient + softer purple glow.
 * - Rainbow mode: NeuCard uses grey surface + purple glow; gradient cards use VolumeGradient.
 */
import { Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { useEffect, useRef } from "react"
import { LinearGradient } from "expo-linear-gradient"
import { gradients, radius, useTheme } from "../lib/theme"
import { useColorMode } from "../store/colorMode"

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
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const theme = useTheme()
  const shadow = gradient ? theme.shadowGlow : small ? theme.shadowRaisedSm : theme.shadowRaised
  const r = small ? radius.sm : radius.md

  // ── Rainbow mode ─────────────────────────────────────────────
  if (isRainbow && gradient) {
    // VolumeGradient wraps gradient cards for 3D gloss effect
    const handler = onPress && !disabled ? onPress : undefined
    return (
      <VolumeGradient
        colors={gradient}
        shadowColor="#8B3DFF"
        shadowOpacity={0.28}
        borderRadius={r}
        {...(handler !== undefined ? { onPress: handler } : {})}
        style={style}
        glossOpacity={0.32}
      >
        {children}
      </VolumeGradient>
    )
  }

  if (isRainbow && !gradient) {
    const rainbowWrapper: ViewStyle = {
      borderRadius: r,
      backgroundColor: "#F2F2F6",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: "rgba(255,255,255,0.90)",
      borderLeftColor: "rgba(255,255,255,0.85)",
      borderRightColor: "rgba(180,160,255,0.12)",
      borderBottomColor: "rgba(180,160,255,0.18)",
      shadowColor: "#8B3DFF",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 5,
    }
    const inner = (
      <View style={[{ borderRadius: r, backgroundColor: "#F2F2F6", overflow: "hidden" }, style]}>
        {children}
      </View>
    )
    if (onPress && !disabled) {
      return (
        <Pressable onPress={onPress} style={({ pressed }) => [rainbowWrapper, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>
          {inner}
        </Pressable>
      )
    }
    return <View style={rainbowWrapper}>{inner}</View>
  }

  // ── Pastel mode ───────────────────────────────────────────────
  // Highlight rim approximates the top-left light source on neumorphic surfaces.
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
  const { mode } = useColorMode()

  // Rainbow mode: static grey card — no animation, clean and fast
  if (mode === "rainbow") {
    return (
      <View style={[
        s.lavaRoot,
        {
          backgroundColor: "#EDEDF2",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.85)",
          borderRadius: 32,
          shadowColor: "#8B3DFF",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.13,
          shadowRadius: 18,
          elevation: 5,
        },
        style,
      ]}>
        <View style={contentStyle}>{children}</View>
      </View>
    )
  }

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

// ── Volumetric gradient pill (rainbow mode) ───────────────────
// Replicates the glossy inflated pill aesthetic: rich multi-stop gradient,
// white specular highlight top-left, and a soft colored drop shadow.
type VolumeGradientProps = {
  children?: React.ReactNode
  colors: readonly [string, string, ...string[]]
  shadowColor: string
  shadowOpacity?: number
  style?: StyleProp<ViewStyle>
  borderRadius?: number
  onPress?: () => void
  glossOpacity?: number
}

export function VolumeGradient({
  children,
  colors,
  shadowColor,
  shadowOpacity = 0.50,
  style,
  borderRadius = 28,
  onPress,
  glossOpacity = 0.28,
}: VolumeGradientProps) {
  // Extract layout-only props so flex/width/height apply to the outer shadow wrapper,
  // not just the inner content view (fixes tiles not sharing space equally).
  const flat = StyleSheet.flatten(style) ?? ({} as ViewStyle)
  const { flex, flexGrow, flexShrink, flexBasis, width, height, minWidth, maxWidth, minHeight, maxHeight, alignSelf, ...innerStyle } = flat
  const outerLayout: ViewStyle = Object.fromEntries(
    Object.entries({ flex, flexGrow, flexShrink, flexBasis, width, height, minWidth, maxWidth, minHeight, maxHeight, alignSelf })
      .filter(([, v]) => v !== undefined),
  ) as ViewStyle

  const shadow: ViewStyle = {
    shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity,
    shadowRadius: 28,
    elevation: 14,
  }
  const inner = (
    <View style={[{ borderRadius, overflow: "hidden" }, innerStyle]}>
      <LinearGradient
        colors={colors as unknown as [string, string, ...string[]]}
        start={{ x: 0.18, y: 0 }}
        end={{ x: 0.82, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Specular highlight — oval in upper-left mimics a round light source */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "6%",
          left: "8%",
          width: "62%",
          height: "36%",
          borderRadius: 99,
          backgroundColor: `rgba(255,255,255,${glossOpacity})`,
        }}
      />
      {/* Rim light — faint white border on top edge */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.30)",
          borderBottomColor: "rgba(0,0,0,0.08)",
        }}
      />
      {children}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ borderRadius }, shadow, outerLayout, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
      >
        {inner}
      </Pressable>
    )
  }
  return <View style={[{ borderRadius }, shadow, outerLayout]}>{inner}</View>
}

import { Text } from "react-native"
function PillLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        color: "#6E7D8E",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        textShadowColor: "rgba(255,255,255,0.9)",
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
