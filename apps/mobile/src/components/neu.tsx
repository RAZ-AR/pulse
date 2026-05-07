/**
 * Neumorphic primitives: NeuCard, NeuInset, GradPill.
 *
 * RN can't do CSS-style multi-direction or inset shadows, so we approximate:
 * - NeuCard raised: single dark shadow bottom-right with a 1px highlight rim on top.
 * - NeuInset: a darker bg + subtle top/left dim for "pressed" feel.
 * - Gradient cards: LinearGradient + softer purple glow.
 */
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { radius, useTheme } from "../lib/theme"

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
})
