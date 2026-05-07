import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack } from "expo-router"
import { Pedometer } from "expo-sensors"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, gradients, useTheme } from "../src/lib/theme"
import { NeuCard } from "../src/components/neu"
import { stepMultiplier } from "@pulse/shared"

const TIERS = [
  { min: 0, max: 4999, mult: 1.0, label: "Casual" },
  { min: 5000, max: 9999, mult: 1.1, label: "Active" },
  { min: 10000, max: 14999, mult: 1.2, label: "Energetic" },
  { min: 15000, max: Infinity, mult: 1.3, label: "On fire" },
]

function startOfDay(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function StepsScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const utils = trpc.useUtils()

  const me = trpc.user.me.useQuery()
  const sync = trpc.user.syncSteps.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })

  const [pedometerSteps, setPedometerSteps] = useState<number | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const isAvail = await Pedometer.isAvailableAsync()
        if (!isAvail) {
          if (!cancelled) { setAvailable(false); setError(t("pedometerUnavailable", "Step tracking is not available on this device.")) }
          return
        }
        if (cancelled) return
        setAvailable(true)
        const result = await Pedometer.getStepCountAsync(startOfDay(), new Date())
        if (!cancelled) setPedometerSteps(result.steps)
      } catch (e) {
        if (!cancelled) {
          setAvailable(false)
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => { cancelled = true }
  }, [t])

  const serverSteps = me.data?.stepsToday ?? 0
  const localSteps = pedometerSteps ?? 0
  const displaySteps = Math.max(serverSteps, localSteps)
  const currentMult = stepMultiplier(displaySteps)

  const nextTier = TIERS.find((tier) => tier.min > displaySteps)
  const stepsToNext = nextTier ? nextTier.min - displaySteps : 0

  async function syncNow() {
    if (pedometerSteps === null) {
      Alert.alert(t("noStepsRead", "No steps to sync"), t("noStepsReadDesc", "Pedometer hasn't reported steps yet."))
      return
    }
    try {
      await sync.mutateAsync({ steps: pedometerSteps })
    } catch (e) {
      Alert.alert(t("syncFailed", "Sync failed"), e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("steps", "Steps"),
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <NeuCard gradient={gradients.black} style={s.hero}>
          <View style={s.heroBlob} />
          <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>{t("today", "TODAY")}</Text>
          <Text style={[s.heroValue, { fontFamily: fonts.displayHeavy }]}>{displaySteps.toLocaleString()}</Text>
          <Text style={s.heroSub}>{t("steps", "steps")}</Text>
          <View style={s.multBadge}>
            <Text style={[s.multText, { fontFamily: fonts.bodyBold }]}>
              ×{currentMult.toFixed(1)} {t("multiplier", "multiplier").toUpperCase()}
            </Text>
          </View>
        </NeuCard>

        {/* Multiplier tiers */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("multiplierTiers", "Multiplier tiers").toUpperCase()}
        </Text>
        <NeuCard style={{ padding: 0, marginBottom: 16 }}>
          {TIERS.map((tier, i) => {
            const isActive = displaySteps >= tier.min && displaySteps <= tier.max
            return (
              <View
                key={tier.label}
                style={[
                  s.tierRow,
                  i < TIERS.length - 1 && { borderBottomColor: "rgba(163,160,200,0.15)", borderBottomWidth: 1 },
                ]}
              >
                <View style={s.tierLeft}>
                  <Text style={[s.tierMult, {
                    color: isActive ? colors.ink : theme.textSecondary,
                    fontFamily: isActive ? fonts.displayHeavy : fonts.bodyBold,
                  }]}>
                    ×{tier.mult.toFixed(1)}
                  </Text>
                  <View>
                    <Text style={[s.tierLabel, { color: theme.text, fontFamily: fonts.bodyBold }]}>{tier.label}</Text>
                    <Text style={[s.tierRange, { color: theme.textSecondary }]}>
                      {tier.max === Infinity ? `${tier.min.toLocaleString()}+` : `${tier.min.toLocaleString()}–${tier.max.toLocaleString()}`} {t("steps", "steps")}
                    </Text>
                  </View>
                </View>
                {isActive ? <Text style={s.activeMark}>✓</Text> : null}
              </View>
            )
          })}
        </NeuCard>

        {/* Next tier hint */}
        {nextTier ? (
          <NeuCard style={{ padding: 14, marginBottom: 24 }}>
            <Text style={[s.hintText, { color: theme.text, fontFamily: fonts.bodyBold }]}>
              {stepsToNext.toLocaleString()} {t("stepsToNext", "more steps to ×")}{nextTier.mult.toFixed(1)} {t("multiplier", "multiplier")}
            </Text>
          </NeuCard>
        ) : null}

        {/* Sync */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
          {t("syncWithDevice", "Device pedometer").toUpperCase()}
        </Text>
        <NeuCard style={{ padding: 16, marginBottom: 16 }}>
          {available === null ? (
            <ActivityIndicator color={theme.text} />
          ) : !available ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {error ?? t("pedometerUnavailable", "Step tracking is not available on this device.")}
            </Text>
          ) : (
            <>
              <View style={s.syncRow}>
                <Text style={[s.syncLabel, { color: theme.textSecondary }]}>{t("deviceSteps", "Device steps today")}</Text>
                <Text style={[s.syncValue, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                  {(pedometerSteps ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={s.syncRow}>
                <Text style={[s.syncLabel, { color: theme.textSecondary }]}>{t("syncedSteps", "Last synced")}</Text>
                <Text style={[s.syncValue, { color: theme.text, fontFamily: fonts.bodyBold }]}>
                  {serverSteps.toLocaleString()}
                </Text>
              </View>
              <Pressable onPress={syncNow} disabled={sync.isPending || pedometerSteps === null} style={{ opacity: sync.isPending ? 0.5 : 1 }}>
                <NeuCard
                  gradient={gradients.black}
                  small
                  style={{ padding: 12, alignItems: "center", marginTop: 4 }}
                >
                  <Text style={[s.syncBtnText, { fontFamily: fonts.bodyBold }]}>
                    {sync.isPending ? t("syncing", "Syncing…") : t("syncNow", "Sync now")}
                  </Text>
                </NeuCard>
              </Pressable>
            </>
          )}
        </NeuCard>

        <Text style={[s.footnote, { color: theme.textSecondary }]}>
          {t("stepsFootnote", "Multiplier applies to the next purchase or receipt scan today. Step count resets at midnight.")}
        </Text>
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },

  hero: { padding: 26, alignItems: "center", marginBottom: 24, overflow: "hidden", borderRadius: 32 },
  heroBlob: { position: "absolute", top: -42, right: -42, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  heroLabel: { color: "#91A1B4", fontSize: 11, letterSpacing: 1.5 },
  heroValue: { color: colors.ink, fontSize: 56, lineHeight: 60, marginTop: 4 },
  heroSub: { color: "#91A1B4", fontSize: 13, marginBottom: 12 },
  multBadge: { backgroundColor: "rgba(255,255,255,0.58)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 },
  multText: { color: colors.ink, fontSize: 12, letterSpacing: 0.5 },

  sectionTitle: { fontSize: 11, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },

  tierRow: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tierLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  tierMult: { fontSize: 18, minWidth: 38 },
  tierLabel: { fontSize: 14 },
  tierRange: { fontSize: 11, marginTop: 1 },
  activeMark: { fontSize: 20, color: colors.ink, fontWeight: "800" },

  hintText: { fontSize: 13 },

  syncRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  syncLabel: { fontSize: 12 },
  syncValue: { fontSize: 14 },
  syncBtnText: { color: colors.ink, fontSize: 13 },

  footnote: { fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
})
