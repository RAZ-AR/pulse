import { useEffect } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Providers } from "../src/components/providers"
import { useAuth } from "../src/store/auth"

function AuthGate() {
  const router = useRouter()
  const segments = useSegments()
  const { token, hydrated } = useAuth()

  useEffect(() => {
    if (!hydrated) return
    const onAuthRoute = segments[0] === "onboarding"
    if (!token && !onAuthRoute) {
      router.replace("/onboarding")
    } else if (token && onAuthRoute) {
      router.replace("/(tabs)")
    }
  }, [hydrated, token, segments, router])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <StatusBar style="auto" />
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reward/[id]" />
            <Stack.Screen name="venue/[id]" />
            <Stack.Screen name="leaderboard" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="checkin" />
            <Stack.Screen name="badges" />
            <Stack.Screen name="referrals" />
            <Stack.Screen name="challenges" />
            <Stack.Screen name="challenge/[id]" />
            <Stack.Screen name="steps" />
            <Stack.Screen name="gift" />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
