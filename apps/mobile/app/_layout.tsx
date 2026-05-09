import { useEffect, useRef } from "react"
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Providers } from "../src/components/providers"
import { useAuth } from "../src/store/auth"
import { trpc } from "../src/lib/trpc"
import { usePushToken } from "../src/lib/usePushToken"

function PushRegistrar() {
  const me = trpc.user.me.useQuery()
  usePushToken(me.data?.id)
  return null
}

function isTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false
  // @ts-expect-error – injected by Telegram WebView
  return Boolean(window.Telegram?.WebApp)
}

function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null
  // @ts-expect-error – Telegram injects this into the WebView
  // initData may be empty string in some launch contexts (e.g. keyboard button)
  const d = window.Telegram?.WebApp?.initData
  return typeof d === "string" && d.length > 0 ? d : null
}

function AuthGate() {
  const router = useRouter()
  const segments = useSegments()
  const { token, hydrated } = useAuth()
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)
  const navState = useRootNavigationState()
  const demoAttempted = useRef(false)
  const tgAttempted = useRef(false)
  const demoSignIn = trpc.auth.signInWithEmail.useMutation()
  const tgSignIn = trpc.auth.signInWithTelegram.useMutation()
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1"
  const telegramInitData = getTelegramInitData()
  const telegramMode = isTelegramWebApp() // true if running inside Telegram, even with empty initData
  const sessionProbe = trpc.user.me.useQuery(undefined, {
    enabled: (demoMode || telegramMode) && hydrated && Boolean(token),
    retry: false,
    staleTime: 0,
  })

  useEffect(() => {
    if (!(demoMode || telegramMode) || !hydrated || !token || !sessionProbe.isError) return
    demoAttempted.current = false
    tgAttempted.current = false
    signOut().catch(() => {})
  }, [demoMode, telegramMode, hydrated, token, sessionProbe.isError, signOut])

  // Telegram: if user already has token but hasn't finished onboarding, send to /onboarding
  useEffect(() => {
    if (!telegramMode || !hydrated || !navState?.key || !token) return
    if (!sessionProbe.data) return
    const onboardingRoute = segments[0] === "onboarding"
    if (!sessionProbe.data.onboardingDone && !onboardingRoute) {
      router.replace("/onboarding")
    }
  }, [telegramMode, hydrated, navState?.key, token, sessionProbe.data, segments, router])

  // Telegram auto-login
  useEffect(() => {
    if (!telegramMode || !hydrated || !navState?.key || token || tgAttempted.current) return
    // initData can be empty string in some Telegram launch contexts (keyboard button, session restore).
    // Guard here so we don't pass null to the server validator.
    if (!telegramInitData) {
      router.replace("/onboarding")
      return
    }
    tgAttempted.current = true
    tgSignIn
      .mutateAsync({ initData: telegramInitData })
      .then(async (result) => {
        await signIn(result.token)
        router.replace(result.user.onboardingDone ? "/(tabs)" : "/onboarding")
      })
      .catch(() => {
        router.replace("/onboarding")
      })
  }, [telegramMode, hydrated, token, tgSignIn, telegramInitData, signIn, router, navState?.key])

  // Demo auto-login
  useEffect(() => {
    if (!demoMode || telegramMode || !hydrated || !navState?.key || token || demoAttempted.current) return
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
      .catch(() => {
        router.replace("/onboarding")
      })
  }, [demoMode, telegramMode, hydrated, token, demoSignIn, signIn, router, navState?.key])

  useEffect(() => {
    if (!hydrated || !navState?.key) return
    if ((demoMode || telegramMode) && !token) return
    const onAuthRoute = segments[0] === "onboarding"
    if (!token && !onAuthRoute) {
      router.replace("/onboarding")
    } else if (token && onAuthRoute) {
      router.replace("/(tabs)")
    }
  }, [demoMode, telegramMode, hydrated, token, segments, router, navState?.key])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <StatusBar style="auto" />
          <AuthGate />
          <PushRegistrar />
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
