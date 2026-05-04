import { Tabs } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { fonts, gradients, useTheme } from "../../src/lib/theme"

const TABS = [
  { name: "index",   icon: "⚡", label: "home"    },
  { name: "earn",    icon: "📷", label: "earn"    },
  { name: "rewards", icon: "🎁", label: "rewards" },
  { name: "map",     icon: "🗺️", label: "map"     },
  { name: "profile", icon: "👤", label: "profile" },
] as const

export default function TabsLayout() {
  const { t } = useTranslation("common")
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: theme.text, fontSize: 17, fontFamily: fonts.bodyBold },
        sceneStyle: { backgroundColor: theme.bg },
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopWidth: 0,
          height: 84,
          paddingBottom: 20,
          paddingTop: 10,
          shadowColor: "#A3A0C8",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyBold,
          fontSize: 10,
          letterSpacing: 0.3,
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
            tabBarIcon: ({ focused }) => <NeuTabIcon icon={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  )
}

function NeuTabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  const theme = useTheme()
  return (
    <View style={s.iconWrap}>
      <View
        style={[
          s.icon,
          focused
            ? { backgroundColor: theme.bg, ...theme.shadowRaisedSm }
            : { backgroundColor: "transparent" },
        ]}
      >
        <Text style={s.iconChar}>{icon}</Text>
      </View>
      {focused ? (
        <LinearGradient
          colors={gradients.rainbow as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.indicator}
        />
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  iconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  iconChar: { fontSize: 18 },
  indicator: { position: "absolute", bottom: -3, width: 16, height: 3, borderRadius: 2 },
})
