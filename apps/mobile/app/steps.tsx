import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack } from "expo-router"
import { Pedometer } from "expo-sensors"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"
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

  // Read steps from device pedometer (iOS HealthKit / Android Activity Recognition)
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
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.mint }]}>
          <Text style={s.heroLabel}>{t("today", "TODAY")}</Text>
          <Text style={s.heroValue}>{displaySteps.toLocaleString()}</Text>
          <Text style={s.heroSub}>{t("steps", "steps")}</Text>
          <View style={s.multBadge}>
            <Text style={s.multText}>×{currentMult.toFixed(1)} {t("multiplier", "multiplier").toUpperCase()}</Text>
          </View>
        </View>

        {/* Multiplier tiers */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          {t("multiplierTiers", "Multiplier tiers").toUpperCase()}
        </Text>
        <View style={[s.tiersCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {TIERS.map((tier, i) => {
            const isActive = displaySteps >= tier.min && displaySteps <= tier.max
            return (
              <View
                key={tier.label}
                style={[
                  s.tierRow,
                  i < TIERS.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                ]}
              >
                <View style={s.tierLeft}>
                  <Text style={[s.tierMult, { color: isActive ? colors.mint : theme.textSecondary, fontWeight: isActive ? "800" : "600" }]}>
                    ×{tier.mult.toFixed(1)}
                  </Text>
                  <View>
                    <Text style={[s.tierLabel, { color: theme.text }]}>{tier.label}</Text>
                    <Text style={[s.tierRange, { color: theme.textSecondary }]}>
                      {tier.max === Infinity ? `${tier.min.toLocaleString()}+` : `${tier.min.toLocaleString()}–${tier.max.toLocaleString()}`} {t("steps", "steps")}
                    </Text>
                  </View>
                </View>
                {isActive ? <Text style={[s.activeMark, { color: colors.mint }]}>✓</Text> : null}
              </View>
            )
          })}
        </View>

        {/* Next tier hint */}
        {nextTier ? (
          <View style={[s.hint, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.hintText, { color: theme.text }]}>
              🚶 {stepsToNext.toLocaleString()} {t("stepsToNext", "more steps to ×")}{nextTier.mult.toFixed(1)} {t("multiplier", "multiplier")}
            </Text>
          </View>
        ) : null}

        {/* Sync */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          {t("syncWithDevice", "Device pedometer").toUpperCase()}
        </Text>
        <View style={[s.syncCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {available === null ? (
            <ActivityIndicator color={theme.text} />
          ) : !available ? (
            <Text style={[s.syncErr, { color: theme.textSecondary }]}>
              {error ?? t("pedometerUnavailable", "Step tracking is not available on this device.")}
            </Text>
          ) : (
            <>
              <View style={s.syncRow}>
                <Text style={[s.syncLabel, { color: theme.textSecondary }]}>{t("deviceSteps", "Device steps today")}</Text>
                <Text style={[s.syncValue, { color: theme.text }]}>{(pedometerSteps ?? 0).toLocaleString()}</Text>
              </View>
              <View style={s.syncRow}>
                <Text style={[s.syncLabel, { color: theme.textSecondary }]}>{t("syncedSteps", "Last synced")}</Text>
                <Text style={[s.syncValue, { color: theme.text }]}>{serverSteps.toLocaleString()}</Text>
              </View>
              <Pressable
                onPress={syncNow}
                disabled={sync.isPending || pedometerSteps === null}
                style={[s.btn, { backgroundColor: theme.text, opacity: sync.isPending ? 0.5 : 1, marginTop: 8 }]}
              >
                <Text style={{ color: theme.bg, fontWeight: "700" }}>
                  {sync.isPending ? t("syncing", "Syncing…") : t("syncNow", "Sync now")}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={[s.footnote, { color: theme.textSecondary }]}>
          {t("stepsFootnote", "Multiplier applies to the next purchase or receipt scan today. Step count resets at midnight.")}
        </Text>
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  hero: { borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 24 },
  heroLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, opacity: 0.85 },
  heroValue: { color: "#FFF", fontSize: 56, fontWeight: "800" },
  heroSub: { color: "#FFF", fontSize: 13, opacity: 0.85, marginBottom: 12 },
  multBadge: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  multText: { color: "#FFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  tiersCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  tierRow: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tierLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  tierMult: { fontSize: 18, minWidth: 38 },
  tierLabel: { fontSize: 14, fontWeight: "700" },
  tierRange: { fontSize: 11, marginTop: 1 },
  activeMark: { fontSize: 20, fontWeight: "800" },
  hint: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  hintText: { fontSize: 13, fontWeight: "600" },
  syncCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  syncRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  syncLabel: { fontSize: 12 },
  syncValue: { fontSize: 14, fontWeight: "700" },
  syncErr: { fontSize: 13 },
  btn: { padding: 12, borderRadius: 10, alignItems: "center" },
  footnote: { fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
})
