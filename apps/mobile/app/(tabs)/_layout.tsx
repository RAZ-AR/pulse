import { Tabs } from "expo-router"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, fonts, useTheme } from "../../src/lib/theme"

const TABS = [
  { name: "index",   icon: "⌂", label: "home"    },
  { name: "earn",    icon: "⌁", label: "earn"    },
  { name: "rewards", icon: "□", label: "rewards" },
  { name: "map",     icon: "⌖", label: "map"     },
  { name: "profile", icon: "◦", label: "profile" },
] as const

export default function TabsLayout() {
  const { t } = useTranslation("common")
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // On web (Telegram WebView), useSafeAreaInsets returns 0 for bottom because
  // there's no native iOS safeAreaInsets API. Hard-code a sensible reserve so
  // the floating dock clears the home indicator and Telegram's bottom gesture
  // bar. On native iOS the insets are real.
  const bottomReserve = Platform.OS === "web" ? 24 : Math.max(insets.bottom, 10)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: theme.text, fontSize: 17, fontFamily: fonts.bodyBold },
        sceneStyle: { backgroundColor: theme.bg },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: 82,
          marginHorizontal: 12,
          marginBottom: bottomReserve,
          paddingHorizontal: 10,
          paddingTop: 0,
          paddingBottom: 0,
          borderRadius: 41,
          shadowColor: "#A3B1C6",
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.34,
          shadowRadius: 30,
          elevation: 12,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 82,
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          margin: 0,
        },
        tabBarIconStyle: {
          height: 64,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarBackground: () => <LiquidDockBackground />,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1)),
            tabBarIcon: ({ focused }) => (
              <DockTabIcon
                icon={tab.icon}
                label={t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1))}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

function DockTabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  if (focused) {
    return (
      <View style={[s.tabItem, s.tabItemActive]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.86)", "rgba(235,254,255,0.42)", "rgba(255,244,254,0.58)", "rgba(255,255,255,0.72)"]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.eyeGlow} />
        <View style={s.eyeLens} />
        <View style={s.eyeShine} />
        <View style={s.tabItemContent}>
          <Text style={[s.iconChar, s.iconActive]}>{icon}</Text>
          <Text style={[s.tabLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.tabItem, s.tabItemIdle]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.38)", "rgba(255,255,255,0.12)", "rgba(235,254,255,0.24)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.idleLens} />
      <Text style={[s.iconChar, s.iconIdle]}>{icon}</Text>
    </View>
  )
}

function LiquidDockBackground() {
  // LavaLampSurface was nice but slow to mount in TG WebView, causing the dock
  // to pop in a few hundred ms after the page. Static gradient renders instantly.
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 41 }]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.92)", "rgba(245,247,251,0.78)", "rgba(225,230,239,0.62)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.dockHighlight} />
      <View pointerEvents="none" style={s.dockInnerShadow} />
      <View pointerEvents="none" style={s.dockBottomGlow} />
    </View>
  )
}

const s = StyleSheet.create({
  tabItem: {
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 0,
    marginBottom: 0,
  },
  tabItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  tabItemActive: {
    minWidth: 126,
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.96)",
    borderLeftColor: "rgba(255,255,255,0.82)",
    borderRightColor: "rgba(163,177,198,0.18)",
    borderBottomColor: "rgba(163,177,198,0.22)",
    shadowColor: "#A3B1C6",
    shadowOffset: { width: 7, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 15,
    elevation: 5,
  },
  tabItemIdle: {
    width: 58,
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.62)",
    borderLeftColor: "rgba(255,255,255,0.46)",
    borderRightColor: "rgba(163,177,198,0.12)",
    borderBottomColor: "rgba(163,177,198,0.16)",
    opacity: 0.88,
  },
  eyeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.26)",
    borderRadius: 29,
  },
  eyeLens: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 7,
    height: 25,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.50)",
  },
  eyeShine: {
    position: "absolute",
    left: 24,
    top: 9,
    width: 34,
    height: 9,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.72)",
    transform: [{ rotate: "-10deg" }],
  },
  idleLens: {
    position: "absolute",
    top: 9,
    left: 10,
    right: 10,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  dockHighlight: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 8,
    height: 24,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  dockInnerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 41,
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.94)",
    borderLeftColor: "rgba(255,255,255,0.78)",
    borderRightColor: "rgba(163,177,198,0.18)",
    borderBottomColor: "rgba(163,177,198,0.22)",
  },
  dockBottomGlow: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 7,
    height: 14,
    borderRadius: 14,
    backgroundColor: "rgba(163,177,198,0.10)",
  },
  iconChar: { fontSize: 24, lineHeight: 27, fontWeight: "900" },
  iconActive: { color: colors.ink, marginRight: 8, textShadowColor: "rgba(255,255,255,0.78)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  iconIdle: { color: "#91A1B4", textShadowColor: "rgba(255,255,255,0.74)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tabLabel: { color: colors.ink, fontSize: 13, maxWidth: 70 },
})
