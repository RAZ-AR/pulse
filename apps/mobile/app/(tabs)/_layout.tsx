import { Tabs } from "expo-router"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, neonColors, fonts, useTheme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"

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
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const insets = useSafeAreaInsets()
  const bottomReserve = Platform.OS === "web" ? 24 : Math.max(insets.bottom, 10)

  const activeColor = isRainbow ? neonColors.cyan : colors.ink
  const inactiveColor = isRainbow ? neonColors.muted : "#91A1B4"

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: isRainbow ? "rgba(18,18,42,0.96)" : "rgba(255,255,255,0.92)",
          borderTopWidth: 0,
          height: 64,
          marginHorizontal: 12,
          marginBottom: bottomReserve,
          borderRadius: 32,
          shadowColor: isRainbow ? "#8B3DFF" : "#A3B1C6",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: isRainbow ? 0.55 : 0.22,
          shadowRadius: 20,
          elevation: 8,
          ...(isRainbow ? { borderWidth: 1, borderColor: "rgba(139,61,255,0.25)" } : {}),
        },
        tabBarItemStyle: { height: 64, justifyContent: "center" },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1)),
            tabBarIcon: ({ focused }) => (
              <View style={[s.item, focused && (isRainbow ? s.itemActiveRainbow : s.itemActive)]}>
                <Text style={[s.icon, { color: focused ? activeColor : inactiveColor }]}>{tab.icon}</Text>
                {focused ? (
                  <Text style={[s.label, { fontFamily: fonts.bodyBold, color: activeColor }]} numberOfLines={1}>
                    {t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1))}
                  </Text>
                ) : null}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

const s = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
  },
  itemActive: {
    backgroundColor: "rgba(133,245,242,0.22)",
    paddingHorizontal: 16,
  },
  itemActiveRainbow: {
    backgroundColor: "rgba(0,245,255,0.15)",
    paddingHorizontal: 16,
    shadowColor: "#00F5FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  icon: { fontSize: 22, fontWeight: "900" },
  label: { color: colors.ink, fontSize: 13, marginLeft: 6, maxWidth: 70 },
})
