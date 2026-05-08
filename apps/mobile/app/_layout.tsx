import { useEffect, useRef } from "react"
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Providers } from "../src/components/providers"
import { useAuth } from "../src/store/auth"
import { trpc } from "../src/lib/trpc"

function AuthGate() {
  const router = useRouter()
  const segments = useSegments()
  const { token, hydrated } = useAuth()
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)
  const navState = useRootNavigationState()
  const demoAttempted = useRef(false)
  const demoSignIn = trpc.auth.signInWithEmail.useMutation()
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1"
  const sessionProbe = trpc.user.me.useQuery(undefined, {
    enabled: demoMode && hydrated && Boolean(token),
    retry: false,
    staleTime: 0,
  })

  useEffect(() => {
    if (!demoMode || !hydrated || !token || !sessionProbe.isError) return
    demoAttempted.current = false
    signOut().catch(() => {})
  }, [demoMode, hydrated, token, sessionProbe.isError, signOut])

  useEffect(() => {
    if (!demoMode || !hydrated || !navState?.key || token || demoAttempted.current) return
    demoAttempted.current = true
    demoSignIn
      .mutateAsync({
        email: "demo@pulse.app",
        name: "Demo User",
        homeCity: "Belgrade",
        language: "EN",
      })
      .then(async (result) => {
        await signIn(result.token)
        router.replace("/(tabs)")
      })
      .catch(() => {})
  }, [demoMode, hydrated, token, demoSignIn, signIn, router, navState?.key])

  useEffect(() => {
    if (!hydrated || !navState?.key) return
    if (demoMode && !token) return
    const onAuthRoute = segments[0] === "onboarding"
    if (!token && !onAuthRoute) {
      router.replace("/onboarding")
    } else if (token && onAuthRoute) {
      router.replace("/(tabs)")
    }
  }, [demoMode, hydrated, token, segments, router, navState?.key])

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
            <Stack.Screen name="points-history" />
            <Stack.Screen name="friends" />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
