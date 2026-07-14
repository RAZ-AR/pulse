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
  const currentHash = isBrowser ? window.location.hash : ""
  const source = initialHash.includes("tgWebAppData") ? initialHash : currentHash
  const hash = source.startsWith("#") ? source.slice(1) : source
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

// Escape hatch for previewing the web/guest flow outside real Telegram:
// the SDK script (telegram-web-app.js) creates window.Telegram.WebApp even
// when the page is opened in a plain browser, so isTelegramRuntime() would
// otherwise always report true and get stuck waiting for initData that
// never arrives. Visiting a URL with ?guest=1 forces the guest flow instead.
function forcedGuestMode(): boolean {
  if (!isBrowser) return false
  return new URLSearchParams(window.location.search).get("guest") === "1"
}

export function isTelegramRuntime(): boolean {
  if (!isBrowser) return false
  if (forcedGuestMode()) return false
  if (getTgInitData()) return true
  if (getTgWebApp()) return true
  return navigator.userAgent.includes("Telegram")
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

function b64urlDecode(s: string): string {
  try {
    const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
    return decodeURIComponent(escape(atob(pad)))
  } catch {
    return ""
  }
}

/** Pet handed off from the landing: startapp=pet-<KEY>-<base64url(name)>. */
export function readPetStartParam(): { key: string; name?: string } | undefined {
  const p = getTgStartParam()
  if (!p || !p.startsWith("pet-")) return undefined
  const [, key, b64] = p.split("-")
  if (!key) return undefined
  const name = b64 ? b64urlDecode(b64).trim().slice(0, 20) : undefined
  return name ? { key, name } : { key }
}
