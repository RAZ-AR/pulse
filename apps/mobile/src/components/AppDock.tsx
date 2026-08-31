import { useEffect, useMemo, useRef } from "react"
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Circle, Path } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import { fonts, useTheme } from "../lib/theme"
import { useColorMode } from "../store/colorMode"

const colors = {
  black: "#000000",
  white: "#FFFFFF",
  bg: "#F5F4F0",
  teal: "#1f71b8",
}

const screenW = Dimensions.get("window").width
const hMargin = 20
const dockW = screenW - hMargin * 2
const dockH = 60
const tabN = 5
const slotW = dockW / tabN
const indW = 84
const indH = 44
const indTop = (dockH - indH) / 2

const tabs = [
  { key: "index", label: "Home", href: "/" },
  { key: "earn", label: "Earn", href: "/earn" },
  { key: "rewards", label: "Rewards", href: "/rewards" },
  { key: "map", label: "Map", href: "/map" },
  { key: "profile", label: "Profile", href: "/profile" },
] as const

function activeIndex(pathname: string) {
  if (pathname.startsWith("/earn") || pathname.startsWith("/scan") || pathname.startsWith("/checkin")) return 1
  if (pathname.startsWith("/rewards") || pathname.startsWith("/reward")) return 2
  if (pathname.startsWith("/map") || pathname.startsWith("/venue")) return 3
  if (pathname.startsWith("/profile") || pathname.startsWith("/badges") || pathname.startsWith("/referrals") || pathname.startsWith("/friends") || pathname.startsWith("/gift")) return 4
  return 0
}

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

const icons = [IconHome, IconEarn, IconRewards, IconMap, IconProfile] as const

export function AppDock() {
  const router = useRouter()
  const pathname = usePathname()
  const { mode } = useColorMode()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const onOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/")
  const index = useMemo(() => activeIndex(pathname), [pathname])
  const indX = useRef(new Animated.Value(index * slotW + (slotW - indW) / 2)).current
  const isRainbow = mode === "rainbow"
  const bottom = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 8)

  useEffect(() => {
    Animated.spring(indX, {
      toValue: index * slotW + (slotW - indW) / 2,
      useNativeDriver: Platform.OS !== "web",
      tension: 180,
      friction: 15,
    }).start()
  }, [index, indX])

  if (onOnboarding) return null

  const activeColor = colors.white
  const inactiveColor = isRainbow ? "rgba(190,170,255,0.50)" : colors.black
  const wrapperStyle = Platform.OS === "web"
    ? [s.wrapper, { bottom, position: "fixed" as "absolute", zIndex: 1000 }]
    : [s.wrapper, { bottom }]

  return (
    <View pointerEvents="box-none" style={wrapperStyle}>
      <View style={[s.shell, isRainbow ? { backgroundColor: theme.surface, borderColor: theme.border } : s.shellNormal]}>
        <Animated.View
          pointerEvents="none"
          style={[
            s.indicator,
            isRainbow ? s.indRainbow : s.indNormal,
            { transform: [{ translateX: indX }] },
          ]}
        >
          {isRainbow ? (
            <LinearGradient
              colors={["#8B3DFF", "#2B6EFF", "#00C2FF"]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={s.highlight} />
          )}
        </Animated.View>

        {tabs.map((tab, tabIndex) => {
          const focused = tabIndex === index
          const Icon = icons[tabIndex] ?? IconHome
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href as never)}
              style={s.slot}
            >
              <Icon color={focused ? activeColor : inactiveColor} />
              {focused ? (
                <Text style={[s.label, { color: activeColor, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: hMargin,
    right: hMargin,
    height: dockH,
  },
  shell: {
    flex: 1,
    flexDirection: "row",
    height: dockH,
    borderRadius: 10,
    alignItems: "center",
  },
  shellNormal: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.black,
    shadowColor: colors.black,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 12,
  },
  indicator: {
    position: "absolute",
    top: indTop,
    left: 0,
    width: indW,
    height: indH,
    borderRadius: 6,
    overflow: "hidden",
  },
  indNormal: {
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.black,
  },
  indRainbow: {
    backgroundColor: "transparent",
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1,
  },
  slot: {
    flex: 1,
    height: dockH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0,
  },
})
