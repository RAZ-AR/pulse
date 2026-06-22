import { useEffect, useRef } from "react"
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"
import * as Notifications from "expo-notifications"
import { Providers } from "../src/components/providers"
import { useAuth } from "../src/store/auth"
import { signInWithTelegramDirect, trpc } from "../src/lib/trpc"
import { usePushToken } from "../src/lib/usePushToken"
import { getTgWebApp, getTgInitData, isTelegramRuntime, readPetStartParam } from "../src/lib/telegram"
import { PointsFloat } from "../src/components/PointsFloat"

function PushRegistrar() {
  const { token } = useAuth()
  const me = trpc.user.me.useQuery(undefined, { enabled: Boolean(token) })
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
      const data = response.notification.request.content.data as { screen?: string; venueId?: string } | undefined
      const screen = data?.screen
      if (screen === "venue" && data?.venueId) {
        router.push(`/venue/${data.venueId}` as Parameters<typeof router.push>[0])
      } else if (screen && SCREEN_MAP[screen]) {
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

  const demoSignIn = trpc.auth.signInWithEmail.useMutation()
  const namePet = trpc.user.namePet.useMutation()
  const utils = trpc.useUtils()
  const petNamed = useRef(false)

  const tg = getTgWebApp()
  const telegramMode = isTelegramRuntime()
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

  // 1) Auto sign-in (TG or demo). Retries once on failure (Vercel cold start).
  useEffect(() => {
    if (!hydrated || !navReady || token || attempted.current) return
    const initData = getTgInitData()
    if (telegramMode && initData) {
      attempted.current = true
      const trySignIn = () =>
        signInWithTelegramDirect(initData)
          .then((r) => signIn(r.token))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            if (typeof window !== "undefined") {
              try { window.localStorage.setItem("_auth_err", msg) } catch { /* ignore */ }
            }
            // Retry once after 3s — handles Vercel cold start timeout
            setTimeout(() => {
              signInWithTelegramDirect(initData)
                .then((r) => {
                  if (typeof window !== "undefined") {
                    try { window.localStorage.removeItem("_auth_err") } catch { /* ignore */ }
                  }
                  signIn(r.token)
                })
                .catch((err2: unknown) => {
                  const msg2 = err2 instanceof Error ? err2.message : String(err2)
                  if (typeof window !== "undefined") {
                    try { window.localStorage.setItem("_auth_err", `retry: ${msg2}`) } catch { /* ignore */ }
                  }
                })
            }, 3000)
          })
      trySignIn()
    } else if (demoMode) {
      attempted.current = true
      demoSignIn.mutateAsync({
        email: "demo@ayoo.space",
        name: "Demo User",
        homeCity: "Belgrade",
        language: "EN",
      })
        .then((r) => signIn(r.token))
        .catch(noop)
    }
  }, [hydrated, navReady, token, telegramMode, demoMode, tg?.initData, demoSignIn, signIn])

  // 2) Drop stale token on UNAUTHORIZED (invalid/expired JWT) or NOT_FOUND
  //    (the token's user no longer exists, e.g. after a DB reset) — but not on
  //    5xx errors. Dropping it lets the auto sign-in re-fire → fresh onboarding.
  useEffect(() => {
    if (!me.error || !token) return
    const code = (me.error as { data?: { code?: string } })?.data?.code
    if (code !== "UNAUTHORIZED" && code !== "NOT_FOUND") return
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("_auth_err", "Session rejected by server") } catch { /* ignore */ }
    }
    attempted.current = false
    signOut().catch(noop)
  }, [me.error, token, signOut])

  // 2b) Carry the pet name handed off from the landing (startapp=pet-KEY-name),
  //     but only if the user hasn't already named a pet.
  useEffect(() => {
    if (petNamed.current || !token || !me.data) return
    if (me.data.petName && me.data.petName.trim()) { petNamed.current = true; return }
    const pet = readPetStartParam()
    if (!pet?.name) return
    petNamed.current = true
    namePet.mutate({ name: pet.name }, { onSuccess: () => utils.user.me.invalidate() })
  }, [token, me.data, namePet, utils])

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
          <PointsFloat />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pet" />
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
