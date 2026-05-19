// Telegram detection captured once at module load — before expo-router
// strips the URL hash via router.replace().
// Telegram injects #tgWebAppData=... into the URL hash before any JS runs.

const isBrowser = typeof window !== "undefined"

// @ts-expect-error – injected by telegram-web-app.js
const hasSdk = isBrowser && window.Telegram?.WebApp != null
const hasHash = isBrowser && window.location.hash.includes("tgWebAppData")

export const IS_TELEGRAM = hasSdk || hasHash

export function getTgWebApp() {
  if (!isBrowser) return null
  // @ts-expect-error
  return window.Telegram?.WebApp ?? null
}

export function getTgInitData(): string | undefined {
  return getTgWebApp()?.initData || undefined
}

export function getTgUser() {
  return getTgWebApp()?.initDataUnsafe?.user ?? null
}

export function getTgStartParam(): string | undefined {
  return getTgWebApp()?.initDataUnsafe?.start_param || undefined
}
