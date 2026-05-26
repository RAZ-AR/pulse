// Telegram detection captured once at module load — before expo-router
// strips the URL hash via router.replace().
// Telegram injects #tgWebAppData=... into the URL hash before any JS runs.

const isBrowser = typeof window !== "undefined"

// @ts-expect-error – injected by telegram-web-app.js
const hasSdk = isBrowser && window.Telegram?.WebApp != null
const initialHash = isBrowser ? window.location.hash : ""
const hasHash = initialHash.includes("tgWebAppData")

export const IS_TELEGRAM = hasSdk || hasHash

function getHashParams() {
  const hash = initialHash.startsWith("#") ? initialHash.slice(1) : initialHash
  if (!hash) return null
  return new URLSearchParams(hash)
}

function getHashInitData(): string | undefined {
  return getHashParams()?.get("tgWebAppData") || undefined
}

function parseHashInitData() {
  const initData = getHashInitData()
  return initData ? new URLSearchParams(initData) : null
}

export function getTgWebApp() {
  if (!isBrowser) return null
  // @ts-expect-error
  return window.Telegram?.WebApp ?? null
}

export function getTgInitData(): string | undefined {
  return getTgWebApp()?.initData || getHashInitData()
}

export function getTgUser() {
  const sdkUser = getTgWebApp()?.initDataUnsafe?.user
  if (sdkUser) return sdkUser

  const rawUser = parseHashInitData()?.get("user")
  if (!rawUser) return null
  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

export function getTgStartParam(): string | undefined {
  return getTgWebApp()?.initDataUnsafe?.start_param || parseHashInitData()?.get("start_param") || undefined
}
