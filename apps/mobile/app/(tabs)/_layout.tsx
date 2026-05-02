import { Tabs } from "expo-router"
import { useTranslation } from "react-i18next"
import { useTheme } from "../../src/lib/theme"

export default function TabsLayout() {
  const { t } = useTranslation("common")
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { color: theme.text, fontSize: 17, fontWeight: "600" },
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home", "Home") }} />
      <Tabs.Screen name="map" options={{ title: t("nav.map", "Map") }} />
      <Tabs.Screen name="earn" options={{ title: t("nav.earn", "Earn") }} />
      <Tabs.Screen name="rewards" options={{ title: t("nav.rewards", "Rewards") }} />
      <Tabs.Screen name="profile" options={{ title: t("nav.profile", "Profile") }} />
    </Tabs>
  )
}
