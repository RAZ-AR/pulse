import { useEffect, useRef } from "react"
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"
import * as Notifications from "expo-notifications"
import { Providers } from "../src/components/providers"
import { useAuth } from "../src/store/auth"
import { trpc } from "../src/lib/trpc"
import { usePushToken } from "../src/lib/usePushToken"
import { IS_TELEGRAM, getTgWebApp, getTgInitData } from "../src/lib/telegram"

function PushRegistrar() {
  const me = trpc.user.me.useQuery()
  usePushToken(me.data?.id)
  return null
}

const SCREEN_MAP: Record<string, string> = {
  challenges: "/challenges",
  rewards: "/(tabs)/rewards",
  earn: "/(tabs)/earn",
  home: "/(tabs)",
  leaderboard: "/leaderboard",
  gift: "/gift",
  steps: "/steps",
}

function NotificationHandler() {
  const router = useRouter()
  const { token } = useAuth()

  useEffect(() => {
    if (!token) return
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined
      if (screen && SCREEN_MAP[screen]) {
        router.push(SCREEN_MAP[screen] as Parameters<typeof router.push>[0])
      }
    })
    return () => sub.remove()
  }, [token, router])

  return null
}

const noop = () => {}

function AuthGate() {
  const router = useRouter()
  const segments = useSegments()
  const navReady = !!useRootNavigationState()?.key
  const { token, hydrated } = useAuth()
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)

  const tgSignIn = trpc.auth.signInWithTelegram.useMutation()
  const demoSignIn = trpc.auth.signInWithEmail.useMutation()

  const tg = getTgWebApp()
  const telegramMode = IS_TELEGRAM
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1"
  const onAuthRoute = segments[0] === "onboarding"
  const attempted = useRef(false)

  // Probes the current session. If the server rejects the token we drop it
  // so the auto sign-in below can re-fire on the next reload.
  const me = trpc.user.me.useQuery(undefined, {
    enabled: hydrated && !!token,
    retry: false,
    staleTime: 0,
  })

  // 1) Auto sign-in (TG or demo). Fires once per page lifetime — if it fails,
  // the recovery UI in onboarding offers a hard reload.
  useEffect(() => {
    if (!hydrated || !navReady || token || attempted.current) return
    const initData = getTgInitData()
    if (telegramMode && initData) {
      attempted.current = true
      tgSignIn.mutateAsync({ initData })
        .then((r) => signIn(r.token))
        .catch(noop)
    } else if (demoMode) {
      attempted.current = true
      demoSignIn.mutateAsync({
        email: "demo@ayoo.app",
        name: "Demo User",
        homeCity: "Belgrade",
        language: "EN",
      })
        .then((r) => signIn(r.token))
        .catch(noop)
    }
  }, [hydrated, navReady, token, telegramMode, demoMode, tg?.initData, tgSignIn, demoSignIn, signIn])

  // 2) Drop stale token so onboarding can recover.
  useEffect(() => {
    if (me.isError && token) signOut().catch(noop)
  }, [me.isError, token, signOut])

  // 3) Route. Pure function of state — no per-mode branches.
  useEffect(() => {
    if (!hydrated || !navReady) return
    if (!token) {
      // Email flow: nothing auto-signs us in, push to /onboarding.
      // All unauthenticated users go to /onboarding.
      // IS_TELEGRAM is captured at module load so the hash isn't lost on redirect.
      if (!onAuthRoute) router.replace("/onboarding")
      return
    }
    if (!me.data) return
    if (!me.data.onboardingDone && !onAuthRoute) router.replace("/onboarding")
    else if (me.data.onboardingDone && onAuthRoute) router.replace("/(tabs)")
  }, [hydrated, navReady, token, me.data, onAuthRoute, telegramMode, demoMode, router])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Providers>
          <StatusBar style="auto" />
          <AuthGate />
          <PushRegistrar />
          <NotificationHandler />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reward/[id]" />
            <Stack.Screen name="venue/[id]" />
            <Stack.Screen name="venue/[id]/review" />
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
