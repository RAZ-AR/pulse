/**
 * Neumorphic primitives: NeuCard, NeuInset, GradPill, VolumeGradient.
 *
 * RN can't do CSS-style multi-direction or inset shadows, so we approximate:
 * - NeuCard raised: single dark shadow bottom-right with a 1px highlight rim on top.
 * - NeuInset: a darker bg + subtle top/left dim for "pressed" feel.
 * - Gradient cards: LinearGradient + softer purple glow.
 * - Rainbow mode: NeuCard uses grey surface + purple glow; gradient cards use VolumeGradient.
 */
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { colors, radius, useTheme } from "../lib/theme"
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

  // ── Brutalist mode ───────────────────────────────────────────
  const wrapperStyle: ViewStyle = {
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 3,
    borderColor: theme.border,
    ...shadow,
  }

  const Inner = gradient ? (
    <View style={[{ borderRadius: 5, backgroundColor: colors.skySolid, overflow: "hidden" }, style]}>
      {children}
    </View>
  ) : (
    <View style={[{ borderRadius: 5, backgroundColor: theme.surface, overflow: "hidden" }, style]}>
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
          backgroundColor: "#FFFFFF",
          borderRadius: 6,
          borderWidth: 2,
          borderColor: theme.border,
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
    <View style={[s.pill, style]}>
      <PillLabel label={label} />
    </View>
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
  intensity: _intensity = "solid",
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

  return (
    <View style={[s.lavaRoot, style]}>
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
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        textShadowColor: "transparent",
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
    borderRadius: 4,
    alignSelf: "flex-start",
    backgroundColor: "#1f71b8",
    borderWidth: 2,
    borderColor: "#000000",
  },
  lavaRoot: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#000000",
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
})
