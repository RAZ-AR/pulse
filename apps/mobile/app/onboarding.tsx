import { useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { useAuth } from "../src/store/auth"
import { setLocale } from "../src/lib/i18n"
import { colors, useTheme } from "../src/lib/theme"
import type { SupportedLocale } from "@pulse/shared"

type Step = "language" | "email" | "name"

export default function OnboardingScreen() {
  const theme = useTheme()
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const signIn = useAuth((s) => s.signIn)

  const [step, setStep] = useState<Step>("language")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [error, setError] = useState("")

  const signInMutation = trpc.auth.signInWithEmail.useMutation()

  async function pickLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    setStep("email")
  }

  function continueFromEmail() {
    setError("")
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError(t("errors.invalidEmail", "Enter a valid email address"))
      return
    }
    setEmail(e)
    setStep("name")
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
      const result = await signInMutation.mutateAsync({
        email,
        name: trimmedName,
        language: lng,
        ...(code.length === 6 ? { referralCode: code } : {}),
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
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.pink }]}>
          <Text style={s.brand}>PULSE</Text>
          <Text style={s.tagline}>{t("common:tagline", "Loyalty that competes for you")}</Text>
        </View>

        {step === "language" ? (
          <View style={s.content}>
            <Text style={[s.title, { color: theme.text }]}>{t("chooseLanguage", "Choose your language")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>
              {t("chooseLanguageDesc", "You can change this later in settings.")}
            </Text>
            <LanguageOption code="en" label="English" theme={theme} onPress={() => pickLanguage("en")} />
            <LanguageOption code="ru" label="Русский" theme={theme} onPress={() => pickLanguage("ru")} />
            <LanguageOption code="sr" label="Srpski" theme={theme} onPress={() => pickLanguage("sr")} />
          </View>
        ) : step === "email" ? (
          <View style={s.content}>
            <Text style={[s.title, { color: theme.text }]}>{t("welcomeBonus", "🎁 500 welcome points!")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>
              {t("welcomeBonusDescription", "Spend up to 100 at a time — make it last")}
            </Text>

            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSecondary }]}>{t("email", "Email address")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("emailPlaceholder", "you@example.com")}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={[s.input, { borderColor: theme.border, color: theme.text }]}
              />
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable onPress={continueFromEmail} style={[s.btn, { backgroundColor: theme.text }]}>
              <Text style={{ color: theme.bg, fontWeight: "700", fontSize: 15 }}>{t("common:next", "Next")}</Text>
            </Pressable>
            <Pressable onPress={() => setStep("language")} style={s.linkBtn}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{t("common:back", "Back")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.content}>
            <Text style={[s.title, { color: theme.text }]}>{t("whatsYourName", "What's your name?")}</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>
              {t("nameDesc", "Cashiers will see this when they award you points.")}
            </Text>

            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSecondary }]}>{t("name", "Name")}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("namePlaceholder", "Your name")}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
                autoComplete="name"
                style={[s.input, { borderColor: theme.border, color: theme.text }]}
              />
            </View>

            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSecondary }]}>
                {t("referralCode", "Referral code")} <Text style={[s.optional, { color: theme.textSecondary }]}>· {t("common:optional", "optional")}</Text>
              </Text>
              <TextInput
                value={referralCode}
                onChangeText={(v) => setReferralCode(v.toUpperCase())}
                placeholder={t("referralCodePlaceholder", "ABC123")}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={[s.input, { borderColor: theme.border, color: theme.text, letterSpacing: 3, fontFamily: "monospace" }]}
              />
              {referralCode.length === 6 ? (
                <Text style={[s.bonus, { color: colors.mint }]}>
                  {t("referralBonus", "+50 bonus points for joining with a referral")}
                </Text>
              ) : null}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable
              onPress={submit}
              disabled={signInMutation.isPending}
              style={[s.btn, { backgroundColor: theme.text, opacity: signInMutation.isPending ? 0.5 : 1 }]}
            >
              {signInMutation.isPending ? (
                <ActivityIndicator color={theme.bg} />
              ) : (
                <Text style={{ color: theme.bg, fontWeight: "700", fontSize: 15 }}>
                  {t("getStarted", "Get started")}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setStep("email")} style={s.linkBtn}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{t("common:back", "Back")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function LanguageOption({
  code, label, theme, onPress,
}: { code: string; label: string; theme: ReturnType<typeof useTheme>; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.langOption, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={[s.langCode, { color: theme.textSecondary }]}>{code.toUpperCase()}</Text>
      <Text style={[s.langLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[s.langArrow, { color: theme.textSecondary }]}>→</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { padding: 32, paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  brand: { color: "#FFF", fontSize: 36, fontWeight: "900", letterSpacing: 4 },
  tagline: { color: "#FFF", fontSize: 13, marginTop: 8, opacity: 0.9 },
  content: { padding: 24, paddingTop: 32 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  langOption: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  langCode: { fontSize: 11, fontWeight: "800", letterSpacing: 1, width: 30 },
  langLabel: { fontSize: 16, fontWeight: "600", flex: 1 },
  langArrow: { fontSize: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 4, letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15 },
  btn: { padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  linkBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  error: { color: "#DC2626", fontSize: 13, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: "500" },
  bonus: { fontSize: 12, fontWeight: "700", marginTop: 6 },
})
