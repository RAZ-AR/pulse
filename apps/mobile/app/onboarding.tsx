import { useState, useEffect, useRef } from "react"
import { Animated, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native"
import { AyooLogo } from "../src/components/AyooLogo"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { trpc } from "../src/lib/trpc"
import { useAuth } from "../src/store/auth"
import { setLocale } from "../src/lib/i18n"
import { colors, fonts, gradients, useTheme } from "../src/lib/theme"
import { NeuCard, NeuInset } from "../src/components/neu"
import { CITY_OPTIONS, DEFAULT_CITY } from "../src/lib/venues"
import { uploadAvatarFile } from "../src/lib/storage"
import { IS_TELEGRAM, getTgUser, getTgStartParam as getTgParam } from "../src/lib/telegram"
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

// Loading + auth-status fallback. With no title/desc → just a spinner.
function StatusScreen({ theme, title, desc, button, onPress }: {
  theme: ReturnType<typeof useTheme>
  title?: string; desc?: string; button?: string; onPress?: () => void
}) {
  return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 32 }]}>
      {title ? (
        <>
          <Text style={[s.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy, textAlign: "center" }]}>{title}</Text>
          {desc ? <Text style={[s.subtitle, { color: theme.textSecondary, textAlign: "center", marginTop: 12 }]}>{desc}</Text> : null}
          {button ? (
            <Pressable
              onPress={onPress}
              style={{ marginTop: 24, backgroundColor: theme.text, borderRadius: 99, paddingHorizontal: 28, paddingVertical: 14 }}
            >
              <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{button}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ActivityIndicator color={theme.text} />
      )}
    </View>
  )
}

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

function getTgUserId(): string {
  const id = getTgUser()?.id
  return id ? String(id) : `anon_${Date.now()}`
}

// ── Telegram onboarding (4 steps) ────────────────────────────
// step 0: service description
// step 1: welcome coupon + animation
// step 2: profile (nickname, birthday, avatar, consent)
// step 3: invite friends
function TelegramOnboarding() {
  const theme = useTheme()
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { token, hydrated } = useAuth()
  const signOut = useAuth((s) => s.signOut)

  const [giftToken] = useState<string | undefined>(readTgGiftToken)
  const [referralCode] = useState<string | undefined>(readTgReferralCode)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  useEffect(() => {
    if (!hydrated || token) return
    const id = setTimeout(() => setAuthTimedOut(true), 6000)
    return () => clearTimeout(id)
  }, [hydrated, token])

  const me = trpc.user.me.useQuery(undefined, { enabled: hydrated && Boolean(token), retry: false })
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({ onSuccess: () => utils.user.me.invalidate() })
  const updateProfile = trpc.user.updateProfile.useMutation()

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [displayName, setDisplayName] = useState(() => getTgUserName() ?? "")
  const [birthday, setBirthday] = useState("")
  const [avatarColor, setAvatarColor] = useState(0)
  const [avatarUri, setAvatarUri] = useState<string | null>(null) // local preview URI
  const [avatarUploadUrl, setAvatarUploadUrl] = useState<string | null>(null) // uploaded URL
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const currentLng = (i18n.language ?? "en") as SupportedLocale
  const userName = me.data?.name ?? ""
  const referralLink = me.data?.referralCode
    ? `https://t.me/ayoo_loyalty_bot?start=${me.data.referralCode}`
    : ""

  // Pre-fill name from server once loaded (fallback if Telegram SDK not injected yet)
  useEffect(() => {
    if (userName && !displayName) setDisplayName(userName)
  }, [userName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!me.data?.language) return
    const lang = me.data.language.toLowerCase() as SupportedLocale
    if (i18n.language !== lang) setLocale(lang).catch(() => {})
  }, [me.data?.language]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeLanguage(lng: SupportedLocale) {
    await setLocale(lng)
    updateProfile.mutate({ language: lng.toUpperCase() as "EN" | "RU" | "SR" })
  }

  async function pickPhoto() {
    if (Platform.OS !== "web") return
    return new Promise<void>((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/jpeg,image/png,image/webp"
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(); return }
        const localUrl = URL.createObjectURL(file)
        setAvatarUri(localUrl)
        setAvatarUploading(true)
        try {
          const ownerKey = getTgUserId()
          const uploaded = await uploadAvatarFile(file, ownerKey)
          setAvatarUploadUrl(uploaded)
        } catch {
          setAvatarUri(null) // revert on error
        } finally {
          setAvatarUploading(false)
        }
        resolve()
      }
      input.click()
    })
  }

  async function finish() {
    if (!consent) { setConsentError(true); return }
    const nameToSave = (displayName.trim() || userName || "").trim()
    if (!nameToSave) return
    const lng = (i18n.language ?? "en").toUpperCase() as "EN" | "RU" | "SR"
    const isoDate = parseBirthday(birthday)
    try {
      await completeOnboarding.mutateAsync({
        name: nameToSave,
        language: lng,
        consentGiven: true,
        ...(isoDate ? { birthday: isoDate } : {}),
        ...(referralCode ? { referralCode } : {}),
        ...(giftToken ? { giftToken } : {}),
      })
    } catch (e: unknown) {
      const code = (e as { data?: { code?: string } })?.data?.code
      if (code !== "CONFLICT") throw e
    }
    const finalAvatarUrl = avatarUploadUrl ?? `color:${avatarColor}`
    updateProfile.mutate({ avatarUrl: finalAvatarUrl })
    setStep(3)
  }

  async function shareInvite() {
    if (!referralLink) return
    try {
      await Share.share({
        message: t("shareMessage", "Join me on ayoo — venues compete on the points rate they give. Use my code {{code}} to get 50 welcome points: ayoo.app/r/{{code}}", { code: me.data?.referralCode ?? "" }),
      })
    } catch { /* cancelled */ }
  }

  function goHome() { router.replace("/(tabs)") }

  if (!hydrated || (!token && !authTimedOut) || (token && me.isLoading)) return <StatusScreen theme={theme} />
  if (!token && authTimedOut) return (
    <StatusScreen theme={theme} title={t("signInStuck")} desc={t("signInStuckDesc")} button={t("reload")}
      onPress={() => { if (typeof window !== "undefined") window.location.reload() }} />
  )
  if (me.isError) return (
    <StatusScreen theme={theme} title={t("sessionExpired")} desc={t("sessionExpiredDesc")} button={t("retry")}
      onPress={() => { signOut().catch(() => {}) }} />
  )

  if (step === 0) return (
    <TgServiceStep
      currentLng={currentLng}
      onChangeLang={changeLanguage}
      onContinue={() => setStep(1)}
    />
  )

  if (step === 1) return (
    <TgCouponStep
      name={displayName || userName || ""}
      giftToken={giftToken}
      onContinue={() => setStep(2)}
    />
  )

  if (step === 2) return (
    <TgProfileStep
      displayName={displayName}
      setDisplayName={setDisplayName}
      userName={userName}
      birthday={birthday}
      setBirthday={setBirthday}
      avatarColor={avatarColor}
      setAvatarColor={setAvatarColor}
      avatarUri={avatarUri}
      avatarUploading={avatarUploading}
      onPickPhoto={pickPhoto}
      consent={consent}
      setConsent={(v) => { setConsent(v); if (v) setConsentError(false) }}
      consentError={consentError}
      isPending={completeOnboarding.isPending}
      onBack={() => setStep(1)}
      onFinish={finish}
    />
  )

  return (
    <TgInviteStep
      onShare={shareInvite}
      onSkip={goHome}
    />
  )
}

// ── Step 0: Service description ───────────────────────────────
function TgServiceStep({ currentLng, onChangeLang, onContinue }: {
  currentLng: SupportedLocale
  onChangeLang: (lng: SupportedLocale) => void
  onContinue: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const features = [
    { icon: "↗", title: t("featureEarn"), desc: t("featureEarnDesc") },
    { icon: "✦", title: t("featurePartner"), desc: t("featurePartnerDesc") },
    { icon: "◉", title: t("featureCompete"), desc: t("featureCompeteDesc") },
  ]

  return (
    <View style={[s.tgFullScreen, { backgroundColor: theme.bg }]}>
      {/* Lang switcher */}
      <View style={s.tgLangHeader}>
        {(["en", "ru", "sr"] as SupportedLocale[]).map((lng) => {
          const active = currentLng === lng
          return (
            <Pressable key={lng} onPress={() => onChangeLang(lng)}
              style={[s.tgLangChip, active && s.tgLangChipActive]}>
              <Text style={[s.tgLangText, active && s.tgLangTextActive, { fontFamily: fonts.bodyBold }]}>
                {lng.toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Animated.View style={[s.tgWelcomeBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <AyooLogo width={120} height={70} />
        <Text style={[s.tgHello, { color: theme.text, fontFamily: fonts.displayHeavy, marginTop: 16 }]}>
          {t("serviceTitle", "Welcome to ayoo")}
        </Text>
        <Text style={[s.tgTagline, { color: theme.textSecondary }]}>
          {t("serviceSubtitle")}
        </Text>

        <View style={{ gap: 12, marginTop: 28, width: "100%" }}>
          {features.map((f) => (
            <View key={f.icon} style={[s.featureRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <View style={s.featureIcon}>
                <Text style={{ fontSize: 18, color: "#91A1B4" }}>{f.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.featureTitle, { color: theme.text, fontFamily: fonts.bodyBold }]}>{f.title}</Text>
                <Text style={[s.featureDesc, { color: theme.textSecondary }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={s.tgBottomSheet}>
        <Pressable onPress={onContinue} style={s.tgContinueBtn}>
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("continue", "Continue →")}</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ── Step 1: Welcome coupon ─────────────────────────────────────
function TgCouponStep({ name, giftToken, onContinue }: {
  name: string
  giftToken?: string
  onContinue: () => void
}) {
  const { t } = useTranslation("auth")
  const cardScale = useRef(new Animated.Value(0)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] })

  return (
    <View style={s.tgFullScreen}>
      <LinearGradient colors={["#0F1115", "#1A1F2E"]} style={StyleSheet.absoluteFill} />

      <View style={s.tgWelcomeBody}>
        <Text style={[s.tgHello, { fontFamily: fonts.displayHeavy, marginBottom: 8 }]}>
          {t("tgWelcome", "Hi, {{name}}! 👋", { name: name || "friend" })}
        </Text>
        <Text style={[s.tgTagline, { marginBottom: 32 }]}>
          {t("couponSubtitle", "Here is your welcome gift")}
        </Text>

        {/* Coupon card */}
        <Animated.View style={{ transform: [{ scale: cardScale }], opacity: cardOpacity, width: "100%" }}>
          <Animated.View style={[s.couponGlow, { opacity: glowOpacity }]} />
          <LinearGradient
            colors={["#1E2D4A", "#0F1D36"]}
            style={s.couponCard}
          >
            {/* Дырки купона */}
            <View style={s.couponNotchLeft} />
            <View style={s.couponNotchRight} />
            <View style={s.couponDivider} />

            <View style={s.couponTop}>
              <AyooLogo width={80} height={47} />
              <Text style={[s.couponTitle, { fontFamily: fonts.bodyBold }]}>
                {t("couponTitle", "Congratulations!")}
              </Text>
            </View>

            <View style={s.couponBottom}>
              <Text style={[s.couponAmount, { fontFamily: fonts.displayHeavy }]}>
                {giftToken ? "🎁 " : ""}{t("couponAmount", "500")}
              </Text>
              <Text style={[s.couponUnit, { fontFamily: fonts.bodyBold }]}>
                {t("couponUnit", "points")}
              </Text>
              <Text style={[s.couponConditions]}>
                {t("couponConditions", "Valid 90 days · up to 100 pts per transaction")}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={s.tgBottomSheet}>
        <Pressable onPress={onContinue} style={s.tgContinueBtn}>
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("couponCTA", "Claim gift →")}</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ── Avatar colors ──────────────────────────────────────────────
const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#6366F1", "#0EA5E9"]

function parseBirthday(raw: string): string | undefined {
  // Accepts DD.MM.YYYY or YYYY-MM-DD
  const parts = raw.includes(".") ? raw.split(".") : raw.split("-")
  if (raw.includes(".") && parts.length === 3) {
    const [d, m, y] = parts
    if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  if (!raw.includes(".") && parts.length === 3) {
    const [y, m, d] = parts
    if (y && y.length === 4 && m && d) return `${y}-${m}-${d}`
  }
  return undefined
}

// ── Step 2: Profile ────────────────────────────────────────────
function TgProfileStep({
  displayName, setDisplayName, userName,
  birthday, setBirthday,
  avatarColor, setAvatarColor,
  avatarUri, avatarUploading, onPickPhoto,
  consent, setConsent, consentError,
  isPending, onBack, onFinish,
}: {
  displayName: string; setDisplayName: (v: string) => void; userName: string
  birthday: string; setBirthday: (v: string) => void
  avatarColor: number; setAvatarColor: (i: number) => void
  avatarUri: string | null; avatarUploading: boolean; onPickPhoto: () => void
  consent: boolean; setConsent: (v: boolean) => void; consentError: boolean
  isPending: boolean; onBack: () => void; onFinish: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation("auth")
  const initials = (displayName || userName || "?").slice(0, 2).toUpperCase()
  const selectedColor = AVATAR_COLORS[avatarColor] ?? AVATAR_COLORS[0]

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: theme.bg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.step}>
          <Pressable onPress={onBack} style={s.backBtn}>
            <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>←</Text>
          </Pressable>

          <Text style={[s.bigTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("profileTitle", "Tell us about you")}
          </Text>
          <Text style={[s.subtitle, { color: theme.textSecondary, marginBottom: 28 }]}>
            {t("profileSubtitle", "Takes 30 seconds")}
          </Text>

          {/* Avatar preview + photo button */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Pressable onPress={onPickPhoto} style={s.avatarPreviewWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarPreviewPhoto} />
              ) : (
                <View style={[s.avatarPreviewCircle, { backgroundColor: selectedColor }]}>
                  <Text style={[s.avatarPreviewInitials, { fontFamily: fonts.bodyBold }]}>{initials}</Text>
                </View>
              )}
              <View style={s.avatarCameraBtn}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontSize: 14 }}>📷</Text>
                }
              </View>
            </Pressable>

            {/* Color picker row */}
            <View style={[s.avatarRow, { marginTop: 16 }]}>
              {AVATAR_COLORS.map((color, i) => (
                <Pressable key={color} onPress={() => setAvatarColor(i)}
                  style={[s.avatarCircle, { backgroundColor: color }, i === avatarColor && s.avatarCircleActive]} />
              ))}
            </View>
          </View>

          {/* Nickname */}
          <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginBottom: 6 }]}>
            {t("yourNickname", "Your nickname").toUpperCase()}
          </Text>
          <NeuInset style={{ marginBottom: 6 }}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={userName || "friend"}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
            />
          </NeuInset>
          <Text style={[s.emailHint, { color: theme.textMuted, fontFamily: fonts.body, marginBottom: 16 }]}>
            {t("nicknameHint", "You can change this later in your profile")}
          </Text>

          {/* Birthday */}
          <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginBottom: 6 }]}>
            {t("birthday", "Date of birth").toUpperCase()}
            <Text style={[s.optional, { color: theme.textMuted }]}> · {t("optional", "optional")}</Text>
          </Text>
          <NeuInset style={{ marginBottom: 6 }}>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday((e.target as HTMLInputElement).value)}
                max={new Date().toISOString().split("T")[0]}
                min="1924-01-01"
                style={{
                  width: "100%",
                  height: 44,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "0 14px",
                  fontSize: 15,
                  color: birthday ? theme.text : theme.textMuted,
                  fontFamily: fonts.body,
                  boxSizing: "border-box",
                  cursor: "pointer",
                } as React.CSSProperties}
              />
            ) : (
              <TextInput
                value={birthday}
                onChangeText={setBirthday}
                placeholder={t("birthdayPlaceholder", "DD.MM.YYYY")}
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
              />
            )}
          </NeuInset>
          <Text style={[s.emailHint, { color: theme.textMuted, fontFamily: fonts.body, marginBottom: 20 }]}>
            {t("birthdayHint", "We'll surprise you on your birthday 🎂")}
          </Text>

          {/* Consent */}
          <Pressable onPress={() => setConsent(!consent)} style={s.consentRow}>
            <View style={[s.checkbox, consent && s.checkboxActive, consentError && s.checkboxError]}>
              {consent && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.consentText, { color: consentError ? "#EF4444" : theme.textSecondary, fontFamily: fonts.body }]}>
              {t("consentLabel", "I agree to the processing of personal data")}
            </Text>
          </Pressable>
          {consentError && (
            <Text style={[s.emailHint, { color: "#EF4444", fontFamily: fonts.body, marginTop: 4 }]}>
              {t("consentRequired", "Please accept to continue")}
            </Text>
          )}

          <View style={{ height: 24 }} />

          <NeuCard gradient={gradients.black} onPress={onFinish} disabled={isPending || avatarUploading}
            style={{ padding: 16, alignItems: "center", borderRadius: 99 }}>
            {isPending
              ? <ActivityIndicator color={colors.ink} />
              : <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("getStarted", "Get started")}</Text>
            }
          </NeuCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Step 3: Invite friends ─────────────────────────────────────
function TgInviteStep({ onShare, onSkip }: { onShare: () => void; onSkip: () => void }) {
  const theme = useTheme()
  const { t } = useTranslation("auth")
  const cardScale = useRef(new Animated.Value(0.8)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.tgFullScreen, { backgroundColor: theme.bg }]}>
      <Animated.View style={[s.tgWelcomeBody, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🎁</Text>
        <Text style={[s.tgHello, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
          {t("inviteTitle", "Invite friends")}
        </Text>
        <Text style={[s.tgTagline, { color: theme.textSecondary, textAlign: "center" }]}>
          {t("inviteDesc", "You get +100 points for every friend who joins and makes their first purchase.")}
        </Text>

        <View style={[s.inviteCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Text style={[s.invitePoints, { fontFamily: fonts.displayHeavy, color: theme.text }]}>+100</Text>
          <Text style={[s.invitePointsLabel, { color: theme.textSecondary }]}>points per friend</Text>
        </View>
      </Animated.View>

      <View style={s.tgBottomSheet}>
        <Pressable onPress={onShare} style={s.tgContinueBtn}>
          <Text style={[s.cta, { fontFamily: fonts.displayHeavy }]}>{t("inviteBtn", "Share invite link")}</Text>
        </Pressable>
        <Pressable onPress={onSkip} style={s.skipBtn}>
          <Text style={[s.skipText, { color: theme.textMuted, fontFamily: fonts.body }]}>
            {t("inviteSkip", "Skip for now")}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function OnboardingScreen() {
  const theme = useTheme()
  return IS_TELEGRAM ? <TelegramOnboarding /> : <EmailOnboarding theme={theme} />
}

function EmailOnboarding({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { t, i18n } = useTranslation("auth")
  const router = useRouter()
  const signIn = useAuth((s) => s.signIn)

  const [step, setStep] = useState<Step>(0)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [homeCity, setHomeCity] = useState<"Belgrade" | "Novi Sad">(DEFAULT_CITY.name)
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
        ...(referralCode.length === 6 ? { referralCode } : {}),
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
            referralCode={referralCode}
            setReferralCode={(v) => setReferralCode(cleanReferralCode(v))}
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
        <View style={[s.logoOrb, theme.shadowGlow, { alignItems: "center", justifyContent: "center" }]}>
          <AyooLogo width={120} height={70} />
        </View>
        <Text style={[s.tagline, { color: theme.textSecondary, marginTop: 12 }]}>{t("tagline", "Loyalty that competes for you")}</Text>
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

      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginTop: 8 }]}>
        {t("referralCode", "Referral code").toUpperCase()}
        <Text style={[s.optional, { color: theme.textMuted }]}> · {t("optional", "optional")}</Text>
      </Text>
      <NeuInset style={{ marginBottom: 6 }}>
        <TextInput
          value={referralCode}
          onChangeText={setReferralCode}
          placeholder="ABC123"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          maxLength={6}
          style={[s.input, { color: theme.text, fontFamily: fonts.body, letterSpacing: 3 }]}
        />
      </NeuInset>
      <Text style={[s.emailHint, { color: theme.textMuted, fontFamily: fonts.body, marginBottom: 12 }]}>
        {t("referralHint", "Enter a friend's code to earn bonus points")}
      </Text>

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

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(145,161,180,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  featureTitle: { fontSize: 14, marginBottom: 2 },
  featureDesc: { fontSize: 12, lineHeight: 16 },
  featureSub: { color: "#91A1B4", fontSize: 12, marginTop: 2 },

  // Coupon
  couponGlow: {
    position: "absolute",
    top: -20, left: 20, right: 20, bottom: -20,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
  },
  couponCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    width: "100%",
  },
  couponTop: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 10,
  },
  couponTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  couponDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 0,
  },
  couponNotchLeft: {
    position: "absolute", left: -12, top: "50%" as unknown as number,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#0d0d0d",
  },
  couponNotchRight: {
    position: "absolute", right: -12, top: "50%" as unknown as number,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#0d0d0d",
  },
  couponBottom: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 4,
  },
  couponAmount: {
    color: "#fff",
    fontSize: 64,
    lineHeight: 70,
  },
  couponUnit: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  couponConditions: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    textAlign: "center" as const,
    marginTop: 8,
  },

  // Avatar
  avatarPreviewWrap: { position: "relative", width: 88, height: 88 },
  avatarPreviewCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
  },
  avatarPreviewPhoto: { width: 88, height: 88, borderRadius: 44 },
  avatarPreviewInitials: { color: "#fff", fontSize: 28 },
  avatarCameraBtn: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  avatarCircleActive: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#fff",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  avatarInitials: { color: "#fff", fontSize: 14 },

  // Consent
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(145,161,180,0.4)",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  checkboxError: { borderColor: "#EF4444" },
  checkmark: { color: "#fff", fontSize: 14, lineHeight: 16 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Invite step
  inviteCard: {
    marginTop: 28,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 20,
    alignItems: "center",
  },
  invitePoints: { fontSize: 48, lineHeight: 54 },
  invitePointsLabel: { fontSize: 13, marginTop: 4 },

  skipBtn: { paddingVertical: 14, alignItems: "center" },
  skipText: { fontSize: 14 },

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
