import { Tabs } from "expo-router"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
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
  // useSafeAreaInsets returns 0 on web — Telegram WebView ignores native iOS API.
  // Hard-code a reserve so the dock clears the home indicator.
  const bottomReserve = Platform.OS === "web" ? 24 : Math.max(insets.bottom, 10)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopWidth: 0,
          height: 64,
          marginHorizontal: 12,
          marginBottom: bottomReserve,
          borderRadius: 32,
          shadowColor: "#A3B1C6",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 20,
          elevation: 8,
        },
        tabBarItemStyle: { height: 64, justifyContent: "center" },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: "#91A1B4",
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`nav.${tab.label}`, tab.label[0]!.toUpperCase() + tab.label.slice(1)),
            tabBarIcon: ({ focused }) => (
              <View style={[s.item, focused && s.itemActive]}>
                <Text style={[s.icon, { color: focused ? colors.ink : "#91A1B4" }]}>{tab.icon}</Text>
                {focused ? (
                  <Text style={[s.label, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
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
  icon: { fontSize: 22, fontWeight: "900" },
  label: { color: colors.ink, fontSize: 13, marginLeft: 6, maxWidth: 70 },
})
