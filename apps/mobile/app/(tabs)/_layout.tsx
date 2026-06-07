import { View } from "react-native"
import { Tabs } from "expo-router"
import { useTheme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"

const TABS = [
  { name: "index",   label: "home"    },
  { name: "earn",    label: "earn"    },
  { name: "rewards", label: "rewards" },
  { name: "map",     label: "map"     },
  { name: "profile", label: "profile" },
] as const

// ── Themed root — provides correct bg on mode switch ──────────
// Separate component so TabsLayout itself never re-renders on mode change.
// This prevents React Navigation from scheduling a re-render of screens.
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { mode } = useColorMode()
  const theme = useTheme()
  const bg = mode === "rainbow" ? theme.bg : "#F5F4F0"
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {children}
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <ThemedRoot>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        } as object}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: tab.label[0]!.toUpperCase() + tab.label.slice(1) }}
          />
        ))}
      </Tabs>
    </ThemedRoot>
  )
}
