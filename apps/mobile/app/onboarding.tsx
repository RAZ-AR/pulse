import { useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
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

export default function OnboardingScreen() {
  const theme = useTheme()
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const signIn = useAuth((s) => s.signIn)

  const [step, setStep] = useState<Step>(0)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [homeCity, setHomeCity] = useState(DEFAULT_CITY.name)
  const [referralCode, setReferralCode] = useState("")
  const [error, setError] = useState("")

  const signInMutation = trpc.auth.signInWithEmail.useMutation()

  async function pickLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    setStep(1)
  }

  function continueFromEmail() {
    setError("")
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError(t("errors.invalidEmail", "Enter a valid email address"))
      return
    }
    setEmail(e)
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
      const code = referralCode.trim().toUpperCase()
      const validReferralCode = /^[A-Z0-9]{6}$/.test(code) ? code : undefined
      const result = await signInMutation.mutateAsync({
        email,
        name: trimmedName,
        homeCity,
        language: lng,
        ...(validReferralCode ? { referralCode: validReferralCode } : {}),
      })
      await signIn(result.token)
      router.replace("/(tabs)")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
          />
        ) : null}
        {step === 2 ? (
          <Step2
            name={name}
            setName={setName}
            homeCity={homeCity}
            setHomeCity={setHomeCity}
            referralCode={referralCode}
            setReferralCode={setReferralCode}
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
  email, setEmail, error, onBack, onContinue,
}: { email: string; setEmail: (v: string) => void; error: string; onBack: () => void; onContinue: () => void }) {
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
      </Text>
      <NeuInset style={{ marginBottom: 12 }}>
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
      {error ? <Text style={s.err}>{error}</Text> : null}

      <View style={{ flex: 1, minHeight: 24 }} />

      <NeuCard gradient={gradients.black} onPress={onContinue} style={{ padding: 16, alignItems: "center", borderRadius: 99 }}>
        <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("continue", "Continue →")}</Text>
      </NeuCard>
    </View>
  )
}

// ── Step 2: name + referral code ────────────────────────────
function Step2({
  name, setName, homeCity, setHomeCity, referralCode, setReferralCode, error, isPending, onBack, onSubmit,
}: {
  name: string; setName: (v: string) => void
  homeCity: string; setHomeCity: (v: "Belgrade" | "Novi Sad") => void
  referralCode: string; setReferralCode: (v: string) => void
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

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
        {t("referralCode", "Referral code").toUpperCase()} <Text style={s.optional}>· {t("optional", "optional")}</Text>
      </Text>
      <NeuInset style={{ marginBottom: 12 }}>
        <TextInput
          value={referralCode}
          onChangeText={(v) => setReferralCode(v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={[s.input, { color: theme.text, letterSpacing: 4, fontFamily: fonts.bodyBold }]}
        />
      </NeuInset>
      {referralCode.length === 6 ? (
        <Text style={s.bonusHint}>+50 {t("referralBonus", "bonus points for joining with a referral")}</Text>
      ) : (
        <Text style={s.skipHint}>{t("referralSkipHint", "You can leave this empty and continue.")}</Text>
      )}

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

  backBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingRight: 12, marginBottom: 18 },
  backText: { fontSize: 13 },

  cta: { color: colors.ink, fontSize: 16 },
})
