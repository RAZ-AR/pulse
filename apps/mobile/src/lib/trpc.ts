import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import Constants from "expo-constants"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import type { AppRouter } from "@pulse/trpc/server"

export const trpc = createTRPCReact<AppRouter>()

const TOKEN_KEY = "ayoo.session.token"

export async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null
  }
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setSessionToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (token === null) {
      globalThis.localStorage?.removeItem(TOKEN_KEY)
    } else {
      globalThis.localStorage?.setItem(TOKEN_KEY, token)
    }
    return
  }
  if (token === null) {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }
}

export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv
  // Fallback to LAN-accessible Expo dev host
  const debuggerHost = Constants.expoConfig?.hostUri?.split(":")[0]
  if (debuggerHost) return `http://${debuggerHost}:3000`
  return "http://localhost:3000"
}

export async function signInWithTelegramDirect(initData: string): Promise<{ token: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(`${getApiUrl()}/api/mobile-tg-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      signal: controller.signal,
    })
    const json = await res.json().catch(() => ({})) as { token?: string; error?: string }
    if (!res.ok || !json.token) {
      throw new Error(json.error || `Telegram auth failed (${res.status})`)
    }
    return { token: json.token }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Telegram auth timed out")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getSessionToken()
          return token ? { authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
