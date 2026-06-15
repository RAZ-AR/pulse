import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { signInWithTelegramDirect, trpc } from "../src/lib/trpc"
import { useAuth } from "../src/store/auth"
import { setLocale } from "../src/lib/i18n"
import { colors, fonts, useTheme } from "../src/lib/theme"
import { DeviceChrome, Keypad, ConsentToggle, LcdScreen } from "../src/components/console"
import { HatchStage } from "../src/components/HatchStage"
import { PixelSprite, PET_SPRITES } from "../src/components/AyooPet"
import { getTgInitData, getTgUser, getTgStartParam as getTgParam, isTelegramRuntime } from "../src/lib/telegram"
import type { SupportedLocale } from "@pulse/shared"

function cleanReferralCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)
}

function friendlyAuthError(message: string, fallback: string) {
  const lower = message.toLowerCase()
  if (lower.includes("network") || lower.includes("fetch")) return fallback
  return message
}

// Loading + auth-status fallback. With no title/desc → just a spinner.
function StatusScreen({ theme, title, desc, button, onPress }: {
  theme: ReturnType<typeof useTheme>
  title?: string; desc?: string; button?: string; onPress?: () => void
}) {
  return (
    <View style={[d.container, { backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 32 }]}>
      {title ? (
        <>
          <Text style={[d.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy, textAlign: "center" }]}>{title}</Text>
          {desc ? <Text style={[d.subtitle, { color: theme.textSecondary, textAlign: "center", marginTop: 12 }]}>{desc}</Text> : null}
          {button ? (
            <Pressable onPress={onPress} style={{ marginTop: 24, backgroundColor: colors.skySolid, borderRadius: 99, paddingHorizontal: 32, paddingVertical: 14 }}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>{button}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ActivityIndicator color={theme.text} />
      )}
    </View>
  )
}

// ── Telegram start-param helpers ──────────────────────────────
function readTgGiftToken(): string | undefined {
  const p = getTgParam()
  return p?.startsWith("gift_") ? p.slice(5) : undefined
}
function readTgReferralCode(): string | undefined {
  const p = getTgParam()
  if (!p || p.startsWith("gift_")) return undefined
  return p.length === 6 ? p : undefined
}
function getTgUserName(): string | undefined {
  return getTgUser()?.first_name as string | undefined
}
async function waitForTgInitData(): Promise<string | undefined> {
  for (let i = 0; i < 40; i++) {
    const initData = getTgInitData()
    if (initData) return initData
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return undefined
}
function readStoredAuthError(): string {
  if (typeof window === "undefined") return ""
  try { return window.localStorage.getItem("_auth_err") ?? "" } catch { return "" }
}
function telegramDebugLine(): string {
  const initData = getTgInitData()
  const user = getTgUser()
  return [`tg:${isTelegramRuntime() ? "yes" : "no"}`, `init:${initData ? "yes" : "no"}`, `user:${user?.id ? "yes" : "no"}`].join(" · ")
}

export default function OnboardingScreen() {
  const theme = useTheme()
  return isTelegramRuntime() ? <TelegramOnboarding /> : <EmailOnboarding />
}

// ── Telegram onboarding — silent auth, then the HATCH device flow ──
function TelegramOnboarding() {
  const theme = useTheme()
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { token, hydrated } = useAuth()
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)

  const [giftToken] = useState<string | undefined>(readTgGiftToken)
  const [referralCode] = useState<string | undefined>(readTgReferralCode)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  const [authError, setAuthError] = useState("")
  const [authDebug, setAuthDebug] = useState("")
  const authAttempted = useRef(false)
  const lastToken = useRef<string | null>(null)

  useEffect(() => {
    if (!hydrated || token) return
    const id = setTimeout(() => {
      setAuthDebug(telegramDebugLine())
      setAuthError((current) => current || readStoredAuthError())
      setAuthTimedOut(true)
    }, 25000)
    return () => clearTimeout(id)
  }, [hydrated, token])

  const me = trpc.user.me.useQuery(undefined, { enabled: hydrated && Boolean(token), retry: false })
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({ onSuccess: () => utils.user.me.invalidate() })
  const updateProfile = trpc.user.updateProfile.useMutation()
  const userName = me.data?.name ?? ""

  useEffect(() => {
    if (!hydrated || token || !isTelegramRuntime() || authAttempted.current) return
    authAttempted.current = true
    let cancelled = false
    setAuthTimedOut(false)
    setAuthError("")
    setAuthDebug(telegramDebugLine())

    waitForTgInitData()
      .then((initData) => {
        if (cancelled || token) return
        if (!initData) { setAuthError("Telegram did not provide sign-in data"); return }
        return signInWithTelegramDirect(initData)
      })
      .then((result) => {
        if (!result || cancelled) return
        setAuthError("")
        setAuthDebug("token:received")
        if (typeof window !== "undefined") { try { window.localStorage.removeItem("_auth_err") } catch { /* ignore */ } }
        signIn(result.token).catch(() => setAuthError("Could not save session"))
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setAuthError(msg)
        if (typeof window !== "undefined") { try { window.localStorage.setItem("_auth_err", `onboarding: ${msg}`) } catch { /* ignore */ } }
      })

    return () => { cancelled = true }
  }, [hydrated, token, signIn])

  useEffect(() => {
    if (lastToken.current && !token) authAttempted.current = false
    lastToken.current = token
  }, [token])

  // Sync interface language with the saved profile language once loaded.
  useEffect(() => {
    if (!me.data?.language) return
    const lang = me.data.language.toLowerCase() as SupportedLocale
    if (i18n.language !== lang) setLocale(lang).catch(() => {})
  }, [me.data?.language]) // eslint-disable-line react-hooks/exhaustive-deps

  function changeLanguage(lng: SupportedLocale) {
    setLocale(lng).catch(() => {})
    updateProfile.mutate({ language: lng.toUpperCase() as "EN" | "RU" | "SR" })
  }

  async function handleFinish({ name, consent }: OnboardData) {
    const lng = (i18n.language ?? "en").toUpperCase() as "EN" | "RU" | "SR"
    try {
      await completeOnboarding.mutateAsync({
        name: name || userName || "Friend",
        language: lng,
        consentGiven: consent,
        ...(referralCode ? { referralCode } : {}),
        ...(giftToken ? { giftToken } : {}),
      })
    } catch (e: unknown) {
      const code = (e as { data?: { code?: string } })?.data?.code
      if (code !== "CONFLICT") throw e
    }
    router.replace("/(tabs)")
  }

  if (!hydrated || (!token && !authTimedOut) || (token && me.isLoading)) return <StatusScreen theme={theme} />
  if (!token && authTimedOut) return (
    <StatusScreen theme={theme} title={t("signInStuck")} desc={authError || authDebug || t("signInStuckDesc")} button={t("reload")}
      onPress={() => { if (typeof window !== "undefined") window.location.reload() }} />
  )
  const meErrorCode = (me.error as { data?: { code?: string } } | null)?.data?.code
  if (me.isError && meErrorCode === "UNAUTHORIZED") return (
    <StatusScreen theme={theme} title={t("sessionExpired")} desc={t("sessionExpiredDesc")} button={t("retry")}
      onPress={() => { signOut().catch(() => {}) }} />
  )

  return (
    <DeviceOnboarding
      initialName={getTgUserName() ?? userName}
      petName={me.data?.petName}
      isPending={completeOnboarding.isPending}
      langSwitcher={<LangChips value={i18n.language} onChange={changeLanguage} />}
      onFinish={handleFinish}
    />
  )
}

// ── Web / guest onboarding — guest signup, then the same HATCH flow ──
function EmailOnboarding() {
  const theme = useTheme()
  const { i18n } = useTranslation("auth")
  const router = useRouter()
  const signIn = useAuth((s) => s.signIn)
  const utils = trpc.useUtils()
  const signInMutation = trpc.auth.signInWithEmail.useMutation()
  const completeOnboarding = trpc.user.completeOnboarding.useMutation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [, force] = useState(0)

  function changeLanguage(lng: SupportedLocale) {
    setLocale(lng).catch(() => {})
    force((n) => n + 1)
  }

  async function handleFinish({ name, consent, region, referral }: OnboardData) {
    setError("")
    setPending(true)
    try {
      const lng = (i18n.language as SupportedLocale).toUpperCase() as "EN" | "RU" | "SR"
      const hasRef = referral.length === 6
      // Guest signup (referral bonus is applied here, at account creation).
      const result = await signInMutation.mutateAsync({
        name,
        homeCity: region,
        language: lng,
        ...(hasRef ? { referralCode: referral } : {}),
      })
      await signIn(result.token)
      // Mark onboarding done + record consent (referral already applied above).
      await completeOnboarding.mutateAsync({ name, language: lng, consentGiven: consent }).catch(() => {})
      await utils.user.me.invalidate()
      router.replace("/(tabs)")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(friendlyAuthError(message, "Could not connect. Try again."))
      setPending(false)
    }
  }

  return (
    <DeviceOnboarding
      showRegion
      showReferral
      isPending={pending}
      error={error}
      langSwitcher={<LangChips value={i18n.language} onChange={changeLanguage} />}
      onFinish={handleFinish}
    />
  )
}

// ── Shared device onboarding — the HATCH flow used by both TG and web ──
// Three screens live on one device: hatch → name → consent. Pure UI; the
// parent supplies flags + onFinish (TG: completeOnboarding, web: signup).
const HATCH_GOAL = 500
const HATCHLING = PET_SPRITES.HATCHLING!
const GREEN = "#015634"
const GREEN_EDGE = "#013d24"

type OnboardData = { name: string; consent: boolean; region: "Belgrade" | "Novi Sad"; referral: string }

function DeviceOnboarding({
  initialName = "",
  petName,
  showRegion = false,
  showReferral = false,
  isPending = false,
  error,
  langSwitcher,
  onFinish,
}: {
  initialName?: string
  petName?: string | null | undefined
  showRegion?: boolean
  showReferral?: boolean
  isPending?: boolean
  error?: string
  langSwitcher?: React.ReactNode
  onFinish: (data: OnboardData) => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")
  const [step, setStep] = useState<"hatch" | "name" | "consent">("hatch")
  const [fed, setFed] = useState(0)
  const [name, setName] = useState(initialName)
  const [region, setRegion] = useState<"Belgrade" | "Novi Sad">("Belgrade")
  const [referral, setReferral] = useState("")
  const [consent, setConsent] = useState(false)
  const hatched = fed >= HATCH_GOAL

  const afterHatch = () => setStep(petName ? "consent" : "name")
  function submit() {
    if (!consent || isPending) return
    onFinish({ name: name.trim() || initialName, consent: true, region, referral })
  }

  // ── HATCH ──
  if (step === "hatch") {
    const pads = hatched
      ? [{ key: "next", symbol: "→", label: t("next", "NEXT"), color: GREEN, edge: GREEN_EDGE, solid: true, onPress: afterHatch }]
      : [{ key: "earn", symbol: "+", label: t("earnKey", "EARN"), color: GREEN, edge: GREEN_EDGE, solid: true, onPress: () => setFed((f) => Math.min(HATCH_GOAL, f + 100)) }]
    return (
      <Shell langSwitcher={langSwitcher}>
        <HatchStage fed={fed} goal={HATCH_GOAL} hatchWord={t("petHi", "HI")} tapHint={t("tapPlus", "TAP +")} />
        <Keypad pads={pads} />
      </Shell>
    )
  }

  // ── NAME ──
  if (step === "name") {
    const okPad = { key: "ok", symbol: "✓", label: t("ok", "OK"), color: GREEN, edge: GREEN_EDGE, solid: true, onPress: () => name.trim() && setStep("consent") }
    const backPad = { key: "back", symbol: "◀", label: t("back", "BACK"), color: "#8C887E", onPress: () => setStep("hatch") }
    return (
      <Shell langSwitcher={langSwitcher}>
        <PetStage caption={name.trim() ? `${t("petHi", "HI")}, ${name.trim().toUpperCase()}` : t("nameQ", "NAME?")} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={initialName || t("namePlaceholder", "Alex")}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="words"
          style={[d.input, { color: theme.text, fontFamily: fonts.body }]}
        />
        {showRegion ? (
          <View style={d.regionRow}>
            {(["Belgrade", "Novi Sad"] as const).map((r) => (
              <Pressable key={r} onPress={() => setRegion(r)} style={[d.regionChip, region === r && d.regionChipOn]}>
                <Text style={[d.regionText, { fontFamily: fonts.pixel, color: region === r ? "#FFFFFF" : "#75736A" }]}>
                  {r === "Belgrade" ? "BG" : "NS"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {showReferral ? (
          <TextInput
            value={referral}
            onChangeText={(v) => setReferral(cleanReferralCode(v))}
            placeholder={t("referralPlaceholder", "CODE?")}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
            maxLength={6}
            style={[d.input, { color: theme.text, fontFamily: fonts.pixel, letterSpacing: 3 }]}
          />
        ) : null}
        <Keypad pads={[backPad, okPad]} />
      </Shell>
    )
  }

  // ── CONSENT ──
  const backPad = { key: "back", symbol: "◀", label: t("back", "BACK"), color: "#8C887E", onPress: () => setStep(petName ? "hatch" : "name") }
  const goPad = { key: "go", symbol: "→", label: t("go", "GO"), color: GREEN, edge: GREEN_EDGE, solid: true, onPress: submit }
  return (
    <Shell langSwitcher={langSwitcher}>
      <PetStage asleep={!consent} caption={consent ? t("ready", "READY!") : t("flipToWake", "FLIP TO WAKE")} />
      <ConsentToggle value={consent} onChange={setConsent} label={t("consentShort", "I AGREE · DATA PROCESSING")} />
      {error ? <Text style={[d.error, { fontFamily: fonts.pixel }]} numberOfLines={2}>{error}</Text> : null}
      <Keypad pads={isPending ? [] : consent ? [backPad, goPad] : [backPad]} />
      {isPending ? <ActivityIndicator color={GREEN_EDGE} style={{ marginTop: 6 }} /> : null}
    </Shell>
  )
}

// Cream device body + a scrollable page background.
function Shell({ langSwitcher, children }: { langSwitcher?: React.ReactNode; children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={d.page} style={d.pageBg} keyboardShouldPersistTaps="handled">
      <DeviceChrome right={langSwitcher}>{children}</DeviceChrome>
    </ScrollView>
  )
}

// The hatched pet on the LCD with a caption (used on name / consent screens).
function PetStage({ caption, asleep = false }: { caption: string; asleep?: boolean }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (asleep) return
    const id = setInterval(() => setFrame((f) => 1 - f), 460)
    return () => clearInterval(id)
  }, [asleep])
  return (
    <LcdScreen accent={GREEN}>
      <PixelSprite rows={asleep ? HATCHLING[0] : HATCHLING[frame] ?? HATCHLING[0]} px={9} />
      <Text style={[d.petCaption, { fontFamily: fonts.pixel }]}>{caption}</Text>
    </LcdScreen>
  )
}

// Compact EN/RU/SR chips for the device brand plate.
function LangChips({ value, onChange }: { value: string; onChange: (lng: SupportedLocale) => void }) {
  const cur = (value ?? "en").slice(0, 2)
  return (
    <View style={d.langChips}>
      {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => (
        <Pressable key={lng} onPress={() => onChange(lng)} hitSlop={6}>
          <Text style={[d.langChip, { fontFamily: fonts.pixel, color: cur === lng ? "#015634" : "#B8B4AA" }]}>
            {lng.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const d = StyleSheet.create({
  container: { flex: 1 },
  bigTitle: { fontSize: 34, lineHeight: 38, marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },

  pageBg: { flex: 1, backgroundColor: "#efeeea" },
  page: { padding: 18, paddingTop: 48, paddingBottom: 60, flexGrow: 1, justifyContent: "center" },
  petCaption: { fontSize: 11, letterSpacing: 1, color: "#013d24", marginTop: 6 },
  input: {
    backgroundColor: "#DBDBD7",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C4C4BE",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  regionRow: { flexDirection: "row", gap: 10 },
  regionChip: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#efeeea", borderWidth: 1, borderColor: "rgba(110,102,86,0.12)" },
  regionChipOn: { backgroundColor: GREEN, borderColor: GREEN_EDGE },
  regionText: { fontSize: 11, letterSpacing: 1 },
  error: { fontSize: 8, lineHeight: 12, color: "#fd4600", textAlign: "center" },
  langChips: { flexDirection: "row", gap: 6, marginRight: 2 },
  langChip: { fontSize: 9, letterSpacing: 0.5 },
})
