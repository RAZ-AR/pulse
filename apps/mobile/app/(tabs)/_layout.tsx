import { Tabs } from "expo-router"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path, Circle } from "react-native-svg"
import { neonColors, fonts, useTheme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"

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

export default function TabsLayout() {
  const { t } = useTranslation("common")
  const theme = useTheme()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const insets = useSafeAreaInsets()
  const bottomReserve = Platform.OS === "web" ? 20 : Math.max(insets.bottom, 8)

  // Dark pill in both modes; rainbow gets neon active pill
  const pillBg = isRainbow ? "rgba(10,10,20,0.96)" : "rgba(18,18,18,0.96)"
  const activeColor = isRainbow ? neonColors.cyan : "#FFFFFF"
  const inactiveColor = isRainbow ? "rgba(0,245,255,0.45)" : "rgba(255,255,255,0.40)"
  const activePillBg = isRainbow ? "rgba(0,245,255,0.18)" : "rgba(255,255,255,0.14)"

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: pillBg,
          borderTopWidth: 0,
          height: 60,
          marginHorizontal: 20,
          marginBottom: bottomReserve,
          borderRadius: 30,
          shadowColor: isRainbow ? "#00F5FF" : "#000000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isRainbow ? 0.30 : 0.28,
          shadowRadius: 24,
          elevation: 12,
          ...(isRainbow ? { borderWidth: 1, borderColor: "rgba(0,245,255,0.20)" } : {}),
        },
        tabBarItemStyle: { height: 60 },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      {TABS.map((tab) => {
        const Icon = ICONS[tab.name]
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1)),
              tabBarButton: (props) => {
                const focused = props.accessibilityState?.selected ?? false
                return (
                  <Pressable
                    onPress={props.onPress}
                    onLongPress={props.onLongPress}
                    style={s.tabButton}
                  >
                    <View style={[
                      s.pill,
                      focused && { backgroundColor: activePillBg, paddingHorizontal: 14 },
                      focused && isRainbow && {
                        shadowColor: "#00F5FF",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 8,
                      },
                    ]}>
                      <Icon color={focused ? activeColor : inactiveColor} />
                      {focused ? (
                        <Text style={[s.label, { color: activeColor, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                          {t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1))}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                )
              },
            }}
          />
        )
      })}
    </Tabs>
  )
}

const s = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
})
