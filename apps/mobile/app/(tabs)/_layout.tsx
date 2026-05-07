import { Tabs } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
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
          backgroundColor: "#252936",
          borderTopWidth: 0,
          height: 74,
          marginHorizontal: 14,
          marginBottom: 12,
          paddingHorizontal: 10,
          paddingTop: 9,
          paddingBottom: 9,
          borderRadius: 32,
          shadowColor: "#05060A",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.22,
          shadowRadius: 24,
          elevation: 12,
        },
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
  return (
    <View style={[s.tabItem, focused ? s.tabItemActive : s.tabItemIdle]}>
      <Text style={[s.iconChar, { color: focused ? colors.ink : "rgba(255,255,255,0.58)" }]}>{icon}</Text>
      {focused ? (
        <Text style={[s.tabLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  tabItem: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  tabItemActive: {
    minWidth: 108,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    gap: 7,
  },
  tabItemIdle: {
    width: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconChar: { fontSize: 19, lineHeight: 22, fontWeight: "900" },
  tabLabel: { color: colors.ink, fontSize: 12, maxWidth: 64 },
})
