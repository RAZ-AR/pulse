import { Tabs } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { colors, fonts, useTheme } from "../../src/lib/theme"
import { LavaLampSurface } from "../../src/components/neu"

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
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: 78,
          marginHorizontal: 14,
          marginBottom: 12,
          paddingHorizontal: 12,
          paddingTop: 0,
          paddingBottom: 0,
          borderRadius: 32,
          shadowColor: "#A3B1C6",
          shadowOffset: { width: 9, height: 9 },
          shadowOpacity: 0.42,
          shadowRadius: 16,
          elevation: 12,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 78,
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          margin: 0,
        },
        tabBarIconStyle: {
          height: 58,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarBackground: () => (
          <LavaLampSurface intensity="glass" style={StyleSheet.absoluteFill} />
        ),
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
      <LavaLampSurface
        intensity="glass"
        style={[s.tabItem, s.tabItemActive]}
        contentStyle={s.tabItemContent}
      >
        <View style={s.glassOverlay} />
        <Text style={[s.iconChar, s.iconActive]}>{icon}</Text>
        <Text style={[s.tabLabel, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {label}
        </Text>
      </LavaLampSurface>
    )
  }

  return (
    <LavaLampSurface intensity="glass" style={[s.tabItem, s.tabItemIdle]} contentStyle={s.tabItemContent}>
      <Text style={[s.iconChar, { color: focused ? colors.ink : "#91A1B4" }]}>{icon}</Text>
    </LavaLampSurface>
  )
}

const s = StyleSheet.create({
  tabItem: {
    height: 54,
    borderRadius: 27,
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
  },
  tabItemActive: {
    minWidth: 118,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
  },
  tabItemIdle: {
    width: 54,
    opacity: 0.74,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.42)",
    borderRadius: 27,
  },
  iconChar: { fontSize: 24, lineHeight: 27, fontWeight: "900" },
  iconActive: { color: colors.ink, marginRight: 8 },
  tabLabel: { color: colors.ink, fontSize: 13, maxWidth: 70 },
})
