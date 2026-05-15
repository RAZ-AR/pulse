import { useRef, useEffect, useCallback } from "react"
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { Tabs } from "expo-router"
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Circle } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import { fonts } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"

// ── Layout geometry ────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width
const H_MARGIN = 20
const DOCK_W   = SCREEN_W - H_MARGIN * 2
const DOCK_H   = 60
const TAB_N    = 5
const SLOT_W   = DOCK_W / TAB_N
const IND_W    = 84
const IND_H    = 44
const IND_TOP  = (DOCK_H - IND_H) / 2   // vertical centering = 8

// ── SVG Icons ─────────────────────────────────────────────────
function IconHome({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  )
}
function IconEarn({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12.5L13 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  )
}
function IconRewards({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.9 6.3 6.6.9-4.8 4.7 1.1 6.6L12 17.3l-5.8 3.2 1.1-6.6L2.5 9.2l6.6-.9L12 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  )
}
function IconMap({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8.7 2 6 4.7 6 8c0 5 6 14 6 14s6-9 6-14c0-3.3-2.7-6-6-6z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={8} r={2} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}
function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

const ICONS = {
  index:   IconHome,
  earn:    IconEarn,
  rewards: IconRewards,
  map:     IconMap,
  profile: IconProfile,
} as const

const TABS = [
  { name: "index",   label: "home"    },
  { name: "earn",    label: "earn"    },
  { name: "rewards", label: "rewards" },
  { name: "map",     label: "map"     },
  { name: "profile", label: "profile" },
] as const

// ── Liquid Dock ───────────────────────────────────────────────
function LiquidDock({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation("common")
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const insets = useSafeAreaInsets()
  const bottom = Platform.OS === "web" ? 20 : Math.max(insets.bottom, 8)

  // Indicator slides to: center of active slot
  const indX = useRef(
    new Animated.Value(state.index * SLOT_W + (SLOT_W - IND_W) / 2),
  ).current

  useEffect(() => {
    Animated.spring(indX, {
      toValue: state.index * SLOT_W + (SLOT_W - IND_W) / 2,
      useNativeDriver: true,
      tension: 180,
      friction: 15,
    }).start()
  }, [state.index, indX])

  const activeColor   = isRainbow ? "#FFFFFF"                   : "#1A1A2E"
  const inactiveColor = isRainbow ? "rgba(190,170,255,0.50)"    : "rgba(80,90,110,0.42)"

  return (
    <View pointerEvents="box-none" style={[s.wrapper, { bottom }]}>
      {/* ── Outer shadow shell (no overflow:hidden so shadow renders) ── */}
      <View style={[s.dockShell, isRainbow ? s.shellRainbow : s.shellNormal]}>

        {/* ── Animated liquid indicator ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.indicator,
            isRainbow ? s.indRainbow : s.indNormal,
            { transform: [{ translateX: indX }] },
          ]}
        >
          {isRainbow && (
            <>
              <LinearGradient
                colors={["#8B3DFF", "#2B6EFF", "#00C2FF"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Specular highlight — top-left oval */}
              <View style={s.specular} />
              {/* Rim light */}
              <View style={s.rim} />
            </>
          )}
          {!isRainbow && (
            <>
              {/* Top highlight edge */}
              <View style={s.normalHighlight} />
            </>
          )}
        </Animated.View>

        {/* ── Tab slots ── */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const tab = TABS.find((t) => t.name === route.name)
          if (!tab) return null
          const Icon  = ICONS[tab.name as keyof typeof ICONS]
          const label = t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1))

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
                if (!isFocused && !ev.defaultPrevented) navigation.navigate(route.name)
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={s.slot}
            >
              <Icon color={isFocused ? activeColor : inactiveColor} />
              {isFocused ? (
                <Text style={[s.label, { color: activeColor, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────
// Does NOT call useTheme/useColorMode — those hooks are only in LiquidDock.
// Stable renderDock reference prevents React Navigation from remounting screens
// on every color-mode change (which caused the white-screen flash).
export default function TabsLayout() {
  const renderDock = useCallback(
    (props: BottomTabBarProps) => <LiquidDock {...props} />,
    [],
  )

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={renderDock}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.label[0]!.toUpperCase() + tab.label.slice(1) }}
        />
      ))}
    </Tabs>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: H_MARGIN,
    right: H_MARGIN,
    height: DOCK_H,
  },

  // ── Dock shell ────
  dockShell: {
    flex: 1,
    flexDirection: "row",
    height: DOCK_H,
    borderRadius: DOCK_H / 2,
    alignItems: "center",
  },

  shellNormal: {
    // Frosted light glass
    backgroundColor: "rgba(236,238,244,0.80)",
    borderWidth: 1,
    borderTopColor:    "rgba(255,255,255,0.95)",
    borderLeftColor:   "rgba(255,255,255,0.88)",
    borderRightColor:  "rgba(200,208,226,0.50)",
    borderBottomColor: "rgba(200,208,226,0.55)",
    shadowColor:    "#8090B0",
    shadowOffset:   { width: 0, height: 10 },
    shadowOpacity:  0.22,
    shadowRadius:   28,
    elevation:      12,
  },

  shellRainbow: {
    // Dark purple translucent
    backgroundColor: "rgba(16,8,38,0.65)",
    borderWidth: 1,
    borderColor: "rgba(140,100,255,0.30)",
    shadowColor:   "#8B3DFF",
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius:  28,
    elevation:     14,
  },

  // ── Indicator ─────
  indicator: {
    position: "absolute",
    top:    IND_TOP,
    left:   0,
    width:  IND_W,
    height: IND_H,
    borderRadius: IND_H / 2,
    overflow: "hidden",
  },

  indNormal: {
    // White glass droplet
    backgroundColor:   "rgba(255,255,255,0.90)",
    borderWidth: 1,
    borderTopColor:    "rgba(255,255,255,1.0)",
    borderLeftColor:   "rgba(255,255,255,0.90)",
    borderRightColor:  "rgba(200,210,232,0.45)",
    borderBottomColor: "rgba(200,210,232,0.50)",
  },

  indRainbow: {
    // Filled by LinearGradient child
    backgroundColor: "transparent",
  },

  // Specular highlight for rainbow indicator
  specular: {
    position:  "absolute",
    top:       "8%",
    left:      "7%",
    width:     "52%",
    height:    "38%",
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  // Rim border for rainbow indicator
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:    IND_H / 2,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.35)",
    borderBottomColor: "rgba(0,0,0,0.12)",
  },

  // Top highlight line for normal indicator
  normalHighlight: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
    backgroundColor: "rgba(255,255,255,1.0)",
    borderRadius: 1,
  },

  // ── Tab slot ──────
  slot: {
    flex:           1,
    height:         DOCK_H,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap: 5,
  },

  label: {
    fontSize:      12,
    letterSpacing: -0.3,
  },
})
