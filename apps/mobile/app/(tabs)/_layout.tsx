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
          paddingTop: 10,
          paddingBottom: 10,
          borderRadius: 32,
          shadowColor: colors.lavaPink,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.28,
          shadowRadius: 28,
          elevation: 12,
          overflow: "hidden",
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
      <Text style={[s.iconChar, { color: focused ? colors.ink : "rgba(255,255,255,0.58)" }]}>{icon}</Text>
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
    borderColor: "rgba(255,255,255,0.68)",
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
