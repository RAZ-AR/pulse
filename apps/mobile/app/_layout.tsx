import { useEffect, useRef, useState } from "react"
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
  // Primary: window.Telegram.WebApp is injected natively by Telegram before any scripts run
  // @ts-expect-error
  if (window.Telegram?.WebApp) return true
  // Secondary: TelegramWebviewProxy is the lower-level bridge (older Telegram iOS/Android)
  // @ts-expect-error
  if (window.TelegramWebviewProxy) return true
  // Tertiary: Telegram appends params to URL hash or query string
  const hash = window.location?.hash ?? ""
  if (hash.includes("tgWebAppData") || hash.includes("tgWebAppVersion")) return true
  const search = window.location?.search ?? ""
  return search.includes("tgWebAppData") || search.includes("tgWebAppStartParam")
}

function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null
  // @ts-expect-error
  const d = window.Telegram?.WebApp?.initData
  if (typeof d === "string" && d.length > 0) return d
  // Fallback: parse from URL hash (#tgWebAppData=...)
  const hash = window.location?.hash ?? ""
  if (hash) {
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    const tgData = params.get("tgWebAppData")
    if (tgData && tgData.length > 0) return decodeURIComponent(tgData)
  }
  // Fallback: parse from query string (?tgWebAppData=...)
  const search = window.location?.search ?? ""
  if (search) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    const tgData = params.get("tgWebAppData")
    if (tgData && tgData.length > 0) return decodeURIComponent(tgData)
  }
  return null
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

  // Use state so Telegram detection is reactive — some Telegram versions inject
  // window.Telegram.WebApp slightly after the first synchronous render.
  const [telegramMode, setTelegramMode] = useState(false)
  const [telegramInitData, setTelegramInitData] = useState<string | null>(null)

  useEffect(() => {
    const isTg = isTelegramWebApp()
    setTelegramMode(isTg)
    if (isTg) setTelegramInitData(getTelegramInitData())
  }, [])
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
