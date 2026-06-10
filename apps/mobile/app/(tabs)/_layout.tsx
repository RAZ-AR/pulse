import { useRef, useEffect } from "react"
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { Tabs } from "expo-router"
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Circle } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import { fonts, useTheme } from "../../src/lib/theme"
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
// ── Chunky filled "puffy" icon set ────────────────────────────
function IconHome({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} d="M11.06 3.25a1.5 1.5 0 0 1 1.88 0l7.6 6.08A2 2 0 0 1 21.3 10.9v8.5a2.1 2.1 0 0 1-2.1 2.1H14.3v-5.1a1.1 1.1 0 0 0-1.1-1.1h-2.4a1.1 1.1 0 0 0-1.1 1.1v5.1H4.8a2.1 2.1 0 0 1-2.1-2.1v-8.5a2 2 0 0 1 .76-1.57Z" />
    </Svg>
  )
}
function IconEarn({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} d="M13.4 2.2a.85.85 0 0 1 1.63.55L13.5 9.1h3.6a.9.9 0 0 1 .68 1.49l-8 9.2a.85.85 0 0 1-1.48-.74L9.6 13H6a.9.9 0 0 1-.7-1.46Z" />
    </Svg>
  )
}
function IconRewards({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} d="M12 2.4c.8 6.5 3 8.7 9.5 9.6-6.5.8-8.7 3-9.5 9.5-.8-6.5-3-8.7-9.5-9.5 6.5-.9 8.7-3.1 9.5-9.6Z" />
    </Svg>
  )
}
function IconMap({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} fillRule="evenodd" clipRule="evenodd" d="M12 2.2a6.8 6.8 0 0 1 6.8 6.8c0 4.6-5.1 9.9-6.3 11.1a.7.7 0 0 1-1 0C10.3 18.9 5.2 13.6 5.2 9A6.8 6.8 0 0 1 12 2.2Zm0 4.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </Svg>
  )
}
function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} d="M12 3.1a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2ZM4.6 20.1a7.4 7.4 0 0 1 14.8 0 1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4Z" />
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
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const insets = useSafeAreaInsets()
  const bottom = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 8)

  // Indicator slides to: center of active slot
  const indX = useRef(
    new Animated.Value(state.index * SLOT_W + (SLOT_W - IND_W) / 2),
  ).current

  useEffect(() => {
    // useNativeDriver не поддерживается на вебе — используем JS-анимацию там
    Animated.spring(indX, {
      toValue: state.index * SLOT_W + (SLOT_W - IND_W) / 2,
      useNativeDriver: Platform.OS !== "web",
      tension: 180,
      friction: 15,
    }).start()
  }, [state.index, indX])

  const activeColor   = "#FFFFFF"
  const inactiveColor = isRainbow ? "rgba(190,170,255,0.50)"    : "#d74427"

  // На вебе нужен position:fixed чтобы dock прилипал к низу viewport (не к родителю).
  // React Native Web принимает "fixed" в runtime, но TypeScript это не знает.
  const wrapperStyle = Platform.OS === "web"
    ? [s.wrapper, { bottom, position: "fixed" as "absolute", zIndex: 1000 }]
    : [s.wrapper, { bottom }]

  return (
    <View pointerEvents="box-none" style={wrapperStyle}>
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
              {/* Glass specular + top highlight edge */}
              <View style={s.specular} />
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
          const label = tab.label[0]!.toUpperCase() + tab.label.slice(1)

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

// ── Stable dock renderer (module-level = always same reference) ──
function renderDock(props: BottomTabBarProps) {
  return <LiquidDock {...props} />
}

// ── Themed root — provides correct bg on mode switch ──────────
// Separate component so TabsLayout itself never re-renders on mode change.
// This prevents React Navigation from scheduling a re-render of screens.
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {children}
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <ThemedRoot>
      <Tabs
        screenOptions={{
          headerShown: false,
          // tabBarStyle hidden — we render our own LiquidDock via tabBar prop
          tabBarStyle: { display: "none" },
        } as object}
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
    </ThemedRoot>
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
    // #d74427 glass droplet
    backgroundColor:   "rgba(215,68,39,0.95)",
    borderWidth: 1,
    borderTopColor:    "rgba(255,255,255,0.55)",
    borderLeftColor:   "rgba(255,170,150,0.45)",
    borderRightColor:  "rgba(150,40,20,0.40)",
    borderBottomColor: "rgba(150,40,20,0.55)",
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
