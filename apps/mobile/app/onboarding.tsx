import { useState, useEffect, useRef } from "react"
import { Animated, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../src/lib/trpc"
import { useAuth } from "../src/store/auth"
import { setLocale } from "../src/lib/i18n"
import { colors, fonts, gradients, useTheme } from "../src/lib/theme"
import { NeuCard, NeuInset } from "../src/components/neu"
import { CITY_OPTIONS, DEFAULT_CITY } from "../src/lib/venues"
import type { SupportedLocale } from "@pulse/shared"

type Step = 0 | 1 | 2

function cleanReferralCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)
}

function friendlyAuthError(message: string, fallback: string) {
  const lower = message.toLowerCase()
  if (lower.includes("network") || lower.includes("fetch")) return fallback
  if (lower.includes("email")) return "Enter a valid email address"
  return message
}

// ── Telegram onboarding (2 steps: welcome → city) ────────────
function TelegramOnboarding() {
  const theme = useTheme()
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { token, hydrated } = useAuth()
  const signOut = useAuth((s) => s.signOut)

  // Wait for the AuthGate to finish TG sign-in before asking the server who we are.
  // Without this guard `me` fires with an empty/stale token → 401 → "Open via Telegram"
  // error screen even though the sign-in is still in flight.
  const me = trpc.user.me.useQuery(undefined, { enabled: hydrated && Boolean(token) })
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })

  const [step, setStep] = useState<0 | 1>(0)
  const [homeCity, setHomeCity] = useState(DEFAULT_CITY.name)
  const [displayName, setDisplayName] = useState("")
  const currentLng = (i18n.language ?? "en") as SupportedLocale

  const userName = me.data?.name ?? ""

  // Sync i18n with the language Telegram sent us (language_code in initData).
  // This fires once when me.data loads, ensuring the UI is in the user's language
  // even before they visit profile settings.
  useEffect(() => {
    if (!me.data?.language) return
    const lang = me.data.language.toLowerCase() as SupportedLocale
    if (i18n.language !== lang) {
      setLocale(lang).catch(() => {})
    }
  }, [me.data?.language]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    updateProfile.mutate({ language: lng.toUpperCase() as "EN" | "RU" | "SR" })
  }

  async function finish() {
    const nameToSave = displayName.trim() || userName
    await updateProfile.mutateAsync({
      homeCity,
      onboardingDone: true,
      ...(nameToSave && nameToSave !== userName ? { name: nameToSave } : {}),
    })
    router.replace("/(tabs)")
  }

  // Either the auth store is still hydrating, or AuthGate is mid TG sign-in.
  if (!hydrated || !token || me.isLoading) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    )
  }

  // Stale or rejected token. Sign out so AuthGate's TG-auto-login fires a fresh
  // sign-in on the next render — and give the user a manual retry button just
  // in case auto-recovery doesn't kick in.
  if (me.isError) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 32 }]}>
        <Text style={[s.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy, textAlign: "center" }]}>
          {t("sessionExpired", "Session expired")}
        </Text>
        <Text style={[s.subtitle, { color: theme.textSecondary, textAlign: "center", marginTop: 12 }]}>
          {t("sessionExpiredDesc", "Tap to sign in again with Telegram.")}
        </Text>
        <Pressable
          onPress={() => { signOut().catch(() => {}) }}
          style={{ marginTop: 24, backgroundColor: theme.text, borderRadius: 99, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("retry", "Try again")}</Text>
        </Pressable>
      </View>
    )
  }

  // Step 0 is a fullscreen animation — no ScrollView wrapper, manages its own layout
  if (step === 0) {
    return (
      <TgStep0
        name={userName}
        displayName={displayName}
        setDisplayName={setDisplayName}
        currentLng={currentLng}
        onChangeLang={changeLanguage}
        onContinue={() => setStep(1)}
      />
    )
  }

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: theme.bg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TgStep1
          homeCity={homeCity}
          setHomeCity={setHomeCity}
          isPending={updateProfile.isPending}
          onBack={() => setStep(0)}
          onFinish={finish}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function TgStep0({
  name, displayName, setDisplayName, currentLng, onChangeLang, onContinue,
}: {
  name: string
  displayName: string
  setDisplayName: (v: string) => void
  currentLng: SupportedLocale
  onChangeLang: (lng: SupportedLocale) => void
  onContinue: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")
  const shownName = displayName || name || "friend"

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(40)).current
  const badgeScale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true }).start()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KeyboardAvoidingView style={s.tgFullScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Full-screen gradient — same dark palette as the app */}
      <LinearGradient
        colors={gradients.black as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Language switcher in header ─────────────────────── */}
      <View style={s.tgLangHeader}>
        {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => {
          const active = currentLng === lng
          return (
            <Pressable
              key={lng}
              onPress={() => onChangeLang(lng)}
              style={[s.tgLangChip, active && s.tgLangChipActive]}
            >
              <Text style={[s.tgLangText, active && s.tgLangTextActive, { fontFamily: fonts.bodyBold }]}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Animated welcome section ─────────────────────────── */}
      <Animated.View style={[s.tgWelcomeBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo orb */}
        <View style={s.tgLogoOrb}>
          <Text style={s.tgLogoChar}>P</Text>
        </View>

        {/* Greeting */}
        <Text style={[s.tgHello, { fontFamily: fonts.displayHeavy }]}>
          {t("tgWelcome", "Hi, {{name}}! 👋", { name: shownName })}
        </Text>
        <Text style={[s.tgTagline, { fontFamily: fonts.body }]}>
          {t("tgBonus", "500 welcome points are already yours.")}
        </Text>

        {/* +500 badge — springs in after welcome text */}
        <Animated.View style={[s.tgBonusBadge, { transform: [{ scale: badgeScale }] }]}>
          <Text style={[s.tgBonusPoints, { fontFamily: fonts.displayHeavy }]}>+500</Text>
          <Text style={[s.tgBonusSub, { fontFamily: fonts.body }]}>
            pts · {t("validDays", "valid 90 days")}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* ── Bottom sheet: nickname + continue ────────────────── */}
      <View style={s.tgBottomSheet}>
        <Text style={[s.label, { color: "rgba(255,255,255,0.55)", fontFamily: fonts.bodyBold }]}>
          {t("yourNickname", "Your nickname").toUpperCase()}
        </Text>
        <View style={s.tgInput}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={name || "friend"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            style={[s.input, { color: "#fff", fontFamily: fonts.body }]}
          />
        </View>
        <Text style={[s.tgNicknameHint, { fontFamily: fonts.body }]}>
          {t("nicknameHint", "You can change this later in your profile")}
        </Text>

        <Pressable onPress={onContinue} style={s.tgContinueBtn}>
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>
            {t("continue", "Continue →")}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function TgStep1({
  homeCity, setHomeCity, isPending, onBack, onFinish,
}: {
  homeCity: string
  setHomeCity: (v: "Belgrade" | "Novi Sad") => void
  isPending: boolean
  onBack: () => void
  onFinish: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")

  return (
    <View style={s.step}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>← {t("back", "Back")}</Text>
      </Pressable>

      <Text style={[s.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("pickYourCity", "Pick your city")}
      </Text>
      <Text style={[s.subtitle, { color: theme.textSecondary, marginBottom: 28 }]}>
        {t("cityDesc", "We'll show you venues and partners nearby.")}
      </Text>

      <View style={s.cityRow}>
        {CITY_OPTIONS.map((city) => {
          const active = homeCity === city.name
          return (
            <Pressable
              key={city.name}
              onPress={() => setHomeCity(city.name)}
              style={[s.cityChip, active ? s.cityChipActive : s.cityChipIdle]}
            >
              <Text style={[s.cityChipText, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                {city.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={{ flex: 1, minHeight: 24 }} />

      <NeuCard gradient={gradients.black} onPress={onFinish} disabled={isPending} style={{ padding: 16, alignItems: "center", borderRadius: 99 }}>
        {isPending ? <ActivityIndicator color={colors.ink} /> : (
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("getStarted", "Let's go!")}</Text>
        )}
      </NeuCard>
    </View>
  )
}

// ── Email onboarding ──────────────────────────────────────────
function detectTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false
  // @ts-expect-error
  if (window.Telegram?.WebApp) return true
  // @ts-expect-error – lower-level proxy on older Telegram iOS/Android
  if (window.TelegramWebviewProxy) return true
  // User-Agent check — Telegram's WebView includes "Telegram" in UA
  const ua = navigator?.userAgent ?? ""
  if (ua.includes("Telegram")) return true
  const hash = window.location?.hash ?? ""
  if (hash.includes("tgWebAppData") || hash.includes("tgWebAppVersion")) return true
  const search = window.location?.search ?? ""
  // tgWebAppVersion & tgWebAppPlatform are ALWAYS present in Telegram Mini App URL params
  return (
    search.includes("tgWebAppData") ||
    search.includes("tgWebAppStartParam") ||
    search.includes("tgWebAppVersion") ||
    search.includes("tgWebAppPlatform")
  )
}

export default function OnboardingScreen() {
  const theme = useTheme()

  // null = still detecting (max 2 s wait)
  const [isTg, setIsTg] = useState<boolean | null>(null)

  useEffect(() => {
    if (detectTelegramWebApp()) { setIsTg(true); return }
    let attempts = 0
    const id = setInterval(() => {
      attempts++
      if (detectTelegramWebApp()) { setIsTg(true); clearInterval(id); return }
      if (attempts >= 20) { setIsTg(false); clearInterval(id) }
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Dark screen while detecting environment (≤ 2 s)
  if (isTg === null) {
    return <View style={{ flex: 1, backgroundColor: "#0d0d0d" }} />
  }

  if (isTg) return <TelegramOnboarding />

  return <EmailOnboarding theme={theme} />
}

function EmailOnboarding({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const signIn = useAuth((s) => s.signIn)

  const [step, setStep] = useState<Step>(0)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [homeCity, setHomeCity] = useState<"Belgrade" | "Novi Sad">(DEFAULT_CITY.name)
  const [error, setError] = useState("")

  const signInMutation = trpc.auth.signInWithEmail.useMutation()

  async function pickLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    setStep(1)
  }

  function continueFromEmail() {
    setError("")
    const e = email.trim().toLowerCase()
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError(t("errors.invalidEmail", "Enter a valid email address"))
      return
    }
    setEmail(e)
    setStep(2)
  }

  function skipEmail() {
    setEmail("") // will be filled by backend as guest_xxx@pulse.app
    setStep(2)
  }

  async function submit() {
    setError("")
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t("nameRequired", "Please enter your name"))
      return
    }
    try {
      const lng = (i18n.language as SupportedLocale).toUpperCase() as "EN" | "RU" | "SR"
      const result = await signInMutation.mutateAsync({
        ...(email ? { email } : {}), // omit email if skipped → backend generates guest account
        name: trimmedName,
        homeCity,
        language: lng,
      })
      await signIn(result.token)
      router.replace("/(tabs)")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(friendlyAuthError(message, t("errors.network", "Could not connect. Check the API and try again.")))
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 ? <Step0 onPick={pickLanguage} /> : null}
        {step === 1 ? (
          <Step1
            email={email}
            setEmail={setEmail}
            error={error}
            onBack={() => setStep(0)}
            onContinue={continueFromEmail}
            onSkip={skipEmail}
          />
        ) : null}
        {step === 2 ? (
          <Step2
            name={name}
            setName={setName}
            homeCity={homeCity}
            setHomeCity={setHomeCity}
            error={error}
            isPending={signInMutation.isPending}
            onBack={() => setStep(1)}
            onSubmit={submit}
          />
        ) : null}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Step 0: Hero + language ─────────────────────────────────
function Step0({ onPick }: { onPick: (lng: SupportedLocale) => void }) {
  const theme = useTheme()
  const { t } = useTranslation("auth")

  return (
    <View style={s.step}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <LinearGradient
          colors={gradients.black as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.logoOrb, theme.shadowGlow]}
        >
        <Text style={s.logoChar}>P</Text>
        </LinearGradient>
        <Text style={[s.brand, { color: theme.text, fontFamily: fonts.displayHeavy }]}>PULSE</Text>
        <Text style={[s.tagline, { color: theme.textSecondary }]}>{t("tagline", "Loyalty that competes for you")}</Text>
      </View>

      {/* Feature cards */}
      <View style={{ gap: 12, marginBottom: 24 }}>
        <FeatureCard
          gradient={gradients.black}
          icon="↗"
          title={t("feat1Title", "Venues fight for your visit")}
          sub={t("feat1Sub", "Public competitive rates — live")}
        />
        <FeatureCard
          gradient={gradients.graphite}
          icon="✓"
          title={t("feat2Title", "Streaks, badges, challenges")}
          sub={t("feat2Sub", "Addictive loyalty mechanics")}
        />
        <FeatureCard
          gradient={gradients.black}
          icon="+"
          title={t("welcomeBonus", "500 welcome points!")}
          sub={t("welcomeBonusDescription", "Up to 100 per visit · Valid 90 days")}
        />
      </View>

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
        {t("chooseLanguage", "Choose your language").toUpperCase()}
      </Text>
      <View style={{ gap: 10 }}>
        <LangButton code="en" label="English" onPress={() => onPick("en")} />
        <LangButton code="ru" label="Русский" onPress={() => onPick("ru")} />
        <LangButton code="sr" label="Srpski" onPress={() => onPick("sr")} />
      </View>
    </View>
  )
}

function FeatureCard({
  gradient, icon, title, sub,
}: { gradient: readonly [string, string, ...string[]]; icon: string; title: string; sub: string }) {
  return (
    <NeuCard gradient={gradient} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Text style={s.featureIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.featureTitle, { fontFamily: fonts.bodyBold }]}>{title}</Text>
        <Text style={s.featureSub}>{sub}</Text>
      </View>
    </NeuCard>
  )
}

function LangButton({ code, label, onPress }: { code: string; label: string; onPress: () => void }) {
  const theme = useTheme()
  return (
    <NeuCard
      onPress={onPress}
      style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
    >
      <Text style={[s.langCode, { color: theme.textSecondary, fontFamily: fonts.displayHeavy }]}>{code.toUpperCase()}</Text>
      <Text style={[s.langLabel, { color: theme.text, fontFamily: fonts.bodyBold }]}>{label}</Text>
      <Text style={[s.langArrow, { color: theme.textSecondary }]}>→</Text>
    </NeuCard>
  )
}

// ── Step 1: email + welcome bonus reveal ───────────────────
function Step1({
  email, setEmail, error, onBack, onContinue, onSkip,
}: { email: string; setEmail: (v: string) => void; error: string; onBack: () => void; onContinue: () => void; onSkip: () => void }) {
  const theme = useTheme()
  const { t } = useTranslation("auth")

  return (
    <View style={s.step}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>← {t("back", "Back")}</Text>
      </Pressable>

      <NeuCard gradient={gradients.black} style={{ padding: 22, marginBottom: 28, alignItems: "center", borderRadius: 32 }}>
        <Text style={s.bonusIcon}>+</Text>
        <Text style={[s.bonusTitle, { fontFamily: fonts.displayHeavy }]}>
          {t("welcomeBonus", "500 welcome points!")}
        </Text>
        <Text style={s.bonusSub}>{t("welcomeBonusDescription", "Up to 100 per visit · Valid 90 days")}</Text>
      </NeuCard>

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
        {t("email", "Email address").toUpperCase()}
        <Text style={[s.optional, { color: theme.textMuted }]}> · {t("optional", "optional")}</Text>
      </Text>
      <NeuInset style={{ marginBottom: 6 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t("emailPlaceholder", "you@example.com")}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
        />
      </NeuInset>
      <Text style={[s.emailHint, { color: theme.textMuted, fontFamily: fonts.body }]}>
        {t("emailHint", "You can add it later in your profile")}
      </Text>
      {error ? <Text style={s.err}>{error}</Text> : null}

      <View style={{ flex: 1, minHeight: 24 }} />

      <NeuCard gradient={gradients.black} onPress={onContinue} style={{ padding: 16, alignItems: "center", borderRadius: 99, marginBottom: 10 }}>
        <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("continue", "Continue →")}</Text>
      </NeuCard>

      <Pressable onPress={onSkip} style={{ alignItems: "center", paddingVertical: 10 }}>
        <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("skipForNow", "Skip for now")}
        </Text>
      </Pressable>
    </View>
  )
}

// ── Step 2: name + city ───────────────────────────────────────
function Step2({
  name, setName, homeCity, setHomeCity, error, isPending, onBack, onSubmit,
}: {
  name: string; setName: (v: string) => void
  homeCity: string; setHomeCity: (v: "Belgrade" | "Novi Sad") => void
  error: string; isPending: boolean
  onBack: () => void; onSubmit: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")

  return (
    <View style={s.step}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>← {t("back", "Back")}</Text>
      </Pressable>

      <Text style={[s.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
        {t("whatsYourName", "What's your name?")}
      </Text>
      <Text style={[s.subtitle, { color: theme.textSecondary }]}>
        {t("nameDesc", "Cashiers see this when awarding your points.")}
      </Text>

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginTop: 24 }]}>
        {t("name", "Your name").toUpperCase()}
      </Text>
      <NeuInset style={{ marginBottom: 18 }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("namePlaceholder", "Alex")}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="words"
          autoComplete="name"
          style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
        />
      </NeuInset>

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
        {t("homeCity", "Home city").toUpperCase()}
      </Text>
      <View style={s.cityRow}>
        {CITY_OPTIONS.map((city) => {
          const active = homeCity === city.name
          return (
            <Pressable
              key={city.name}
              onPress={() => setHomeCity(city.name)}
              style={[s.cityChip, active ? s.cityChipActive : s.cityChipIdle]}
            >
              <Text style={[s.cityChipText, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                {city.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {error ? <Text style={s.err}>{error}</Text> : null}

      <View style={{ flex: 1, minHeight: 24 }} />

      <NeuCard gradient={gradients.black} onPress={onSubmit} disabled={isPending} style={{ padding: 16, alignItems: "center", borderRadius: 99 }}>
        {isPending ? <ActivityIndicator color={colors.ink} /> : (
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("getStarted", "Let's go!")}</Text>
        )}
      </NeuCard>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 18, paddingTop: 32 },
  step: { flex: 1, minHeight: 600 },

  // ── TelegramOnboarding Step 0 — fullscreen animated welcome ──
  tgFullScreen: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  tgLangHeader: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  tgLangChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tgLangChipActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  tgLangText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  tgLangTextActive: {
    color: "#fff",
  },
  tgWelcomeBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  tgLogoOrb: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tgLogoChar: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "900",
  },
  tgHello: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
    marginBottom: 8,
  },
  tgTagline: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
  },
  tgBonusBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tgBonusPoints: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 40,
  },
  tgBonusSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 4,
  },
  tgBottomSheet: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  tgInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 6,
  },
  tgNicknameHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  tgContinueBtn: {
    backgroundColor: "#fff",
    borderRadius: 99,
    padding: 16,
    alignItems: "center",
  },

  logoOrb: {
    width: 88, height: 88, borderRadius: 34,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  logoChar: { color: colors.ink, fontSize: 38, fontWeight: "900" },
  brand: { fontSize: 36, letterSpacing: 4 },
  tagline: { fontSize: 13, marginTop: 6 },

  featureIcon: { color: "#91A1B4", fontSize: 28, fontWeight: "900", width: 32, textAlign: "center" },
  featureTitle: { color: colors.ink, fontSize: 14 },
  featureSub: { color: "#91A1B4", fontSize: 12, marginTop: 2 },

  label: { fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: "500", letterSpacing: 0 },

  langCode: { fontSize: 13, letterSpacing: 1, width: 32 },
  langLabel: { fontSize: 16, flex: 1 },
  langArrow: { fontSize: 18 },

  input: { padding: 14, fontSize: 15 },
  cityRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  cityChip: { flex: 1, borderRadius: 99, paddingVertical: 12, alignItems: "center" },
  cityChipActive: { backgroundColor: "#FFFFFF", shadowColor: "#A3B1C6", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 2 },
  cityChipIdle: { backgroundColor: "rgba(249,251,255,0.66)" },
  cityChipText: { fontSize: 13 },

  bonusIcon: { color: "#91A1B4", fontSize: 40, lineHeight: 44, fontWeight: "900", marginBottom: 8 },
  bonusTitle: { color: colors.ink, fontSize: 25, lineHeight: 28, textAlign: "center" },
  bonusSub: { color: "#91A1B4", fontSize: 12, marginTop: 6 },
  bonusHint: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  skipHint: { color: "#91A1B4", fontSize: 12, fontWeight: "700", marginBottom: 8 },

  bigTitle: { fontSize: 34, lineHeight: 38, marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },

  err: { color: "#DC2626", fontSize: 13, marginBottom: 8 },
  emailHint: { fontSize: 12, marginBottom: 12, paddingHorizontal: 4 },

  backBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingRight: 12, marginBottom: 18 },
  backText: { fontSize: 13 },

  cta: { color: colors.ink, fontSize: 16 },

  langChip: { paddingVertical: 12, alignItems: "center" as const },
  langChipText: { fontSize: 13 },
  langChipActive: { color: colors.ink, fontSize: 13 },
})
