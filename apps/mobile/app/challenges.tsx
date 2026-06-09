import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, fonts, gradients, neonColors, useTheme, type Theme } from "../src/lib/theme"
import { useColorMode } from "../src/store/colorMode"
import { NeuCard, GradPill, VolumeGradient } from "../src/components/neu"

const CHALLENGE_GRADS = [gradients.black, gradients.graphite, gradients.black, gradients.graphite] as const

const TYPE_ICON: Record<string, string> = {
  VISIT_N_VENUES: "⌖",
  STREAK: "✓",
  WALK_STEPS: "◦",
  SPEND_AMOUNT: "□",
  COMBO: "◈",
}

type Tab = "mine" | "available"

function daysLeft(end: Date | string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000))
}

export default function ChallengesScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const tx = (key: string, fallback: string, opts?: Record<string, unknown>) =>
    opts ? t(key, fallback, opts) : t(key, fallback)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("mine")

  const mine = trpc.challenge.listMine.useQuery()
  const available = trpc.challenge.listAvailable.useQuery()
  const mineList = mine.data ?? []
  const availableList = available.data ?? []

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("nav.challenges", "Quests"),
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.tabs}>
          <TabButton label={t("myChallenges", "Mine")} count={mineList.length} active={tab === "mine"} onPress={() => setTab("mine")} theme={theme} />
          <TabButton label={t("availableChallenges", "Available")} count={availableList.length} active={tab === "available"} onPress={() => setTab("available")} theme={theme} />
        </View>

        <ScrollView contentContainerStyle={s.list}>
          {tab === "mine" ? (
            mineList.length === 0 ? (
              <Empty
                icon="□"
                title={t("noJoined", "No active challenges")}
                desc={t("noJoinedDesc", "Pick one from Available to start earning bonus points")}
                action={t("browseAvailable", "Browse available")}
                onAction={() => setTab("available")}
                theme={theme}
              />
            ) : (
              mineList.map((uc, i) => {
                const target = uc.challenge.rules as { threshold?: number; count?: number; days?: number }
                const total = target.threshold ?? target.count ?? target.days ?? 1
                const pct = uc.isCompleted ? 100 : Math.min(100, (uc.progress / total) * 100)
                const grad = uc.isCompleted ? gradients.aqua : CHALLENGE_GRADS[i % CHALLENGE_GRADS.length]!
                return (
                  <ChallengeCard
                    key={uc.id}
                    grad={grad}
                    type={uc.challenge.type}
                    title={uc.challenge.title}
                    description={uc.challenge.description}
                    pointsReward={uc.challenge.pointsReward}
                    progress={uc.progress}
                    total={total}
                    pct={pct}
                    daysLeft={daysLeft(uc.challenge.endDate)}
                    completed={uc.isCompleted}
                    sponsorName={uc.challenge.venue?.name ?? null}
                    onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: uc.challengeId } })}
                    t={tx}
                  />
                )
              })
            )
          ) : availableList.length === 0 ? (
            <Empty
              icon="+"
              title={t("noAvailable", "All caught up!")}
              desc={t("noAvailableDesc", "You've joined every active challenge.")}
              theme={theme}
            />
          ) : (
            availableList.map((c, i) => {
              const target = c.rules as { threshold?: number; count?: number; days?: number }
              const total = target.threshold ?? target.count ?? target.days ?? 1
              const sponsored = c.venue !== null
              const grad = sponsored ? gradients.black : CHALLENGE_GRADS[i % CHALLENGE_GRADS.length]!
              return (
                <ChallengeCard
                  key={c.id}
                  grad={grad}
                  type={c.type}
                  title={c.title}
                  description={c.description}
                  pointsReward={c.pointsReward}
                  total={total}
                  daysLeft={daysLeft(c.endDate)}
                  sponsorName={c.venue?.name ?? null}
                  onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: c.id } })}
                  t={tx}
                />
              )
            })
          )}
        </ScrollView>
      </View>
    </>
  )
}

function ChallengeCard({
  grad, type, title, description, pointsReward, progress, total, pct, daysLeft, completed, sponsorName, onPress, t,
}: {
  grad: readonly [string, string, ...string[]]
  type: string
  title: string
  description: string
  pointsReward: number
  progress?: number
  total: number
  pct?: number
  daysLeft: number
  completed?: boolean
  sponsorName?: string | null
  onPress: () => void
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <NeuCard gradient={grad} onPress={onPress} style={ss.card}>
      <View style={ss.cardBlob} />
      <View style={ss.cardHead}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={ss.icon}>
            <Text style={ss.iconText}>{TYPE_ICON[type] ?? "□"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ss.title, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{title}</Text>
            <Text style={ss.desc} numberOfLines={2}>{description}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[ss.reward, { fontFamily: fonts.displayHeavy }]}>+{pointsReward}</Text>
          <Text style={ss.rewardUnit}>pts</Text>
        </View>
      </View>

      {pct !== undefined ? (
        <>
          <View style={ss.progressTrack}>
            <ProgressFill pct={pct} />
          </View>
          <View style={ss.cardFoot}>
            <Text style={ss.progressText}>{progress ?? 0} / {total}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {sponsorName ? <GradPill label={sponsorName} gradient={gradients.gold} /> : null}
              <Text style={ss.daysLeft}>{completed ? t("challengeDone", "✓ Done") : t("daysLeft", "{{n}}d left", { n: daysLeft })}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={[ss.cardFoot, { marginTop: 6 }]}>
          {sponsorName ? <GradPill label={sponsorName} gradient={gradients.gold} /> : <View />}
          <Text style={ss.daysLeft}>{t("daysLeft", "{{n}}d left", { n: daysLeft })} · {t("tapToJoin", "Tap to join →")}</Text>
        </View>
      )}
    </NeuCard>
  )
}

function ProgressFill({ pct }: { pct: number }) {
  const { mode } = useColorMode()
  const fill = mode === "rainbow" ? neonColors.cyan : "rgba(133,245,242,0.95)"
  return <View style={[ss.progressFill, { width: `${pct}%`, backgroundColor: fill }]} />
}

function TabButton({
  label, count, active, onPress, theme,
}: { label: string; count: number; active: boolean; onPress: () => void; theme: Theme }) {
  return (
    <Pressable onPress={onPress} style={s.tab}>
      <Text style={[
        s.tabLabel,
        { color: active ? theme.text : theme.textSecondary, fontFamily: active ? fonts.bodyBold : fonts.body },
      ]}>
        {label} <Text style={{ color: theme.textSecondary }}>{count}</Text>
      </Text>
      {active ? (
        <View style={[s.tabIndicator, theme.shadowGlow]} />
      ) : null}
    </Pressable>
  )
}

function Empty({
  icon, title, desc, action, onAction, theme,
}: { icon: string; title: string; desc: string; action?: string; onAction?: () => void; theme: Theme }) {
  return (
    <NeuCard style={{ padding: 28, alignItems: "center" }}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={[s.emptyTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{title}</Text>
      <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>{desc}</Text>
      {action ? (
        <Pressable onPress={onAction} style={[s.emptyBtn, { backgroundColor: "#F9FBFF" }, theme.shadowRaisedSm]}>
          <Text style={{ color: theme.text, fontFamily: fonts.bodyBold, fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </NeuCard>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: "row", paddingHorizontal: 18, paddingVertical: 6, gap: 12 },
  tab: { paddingVertical: 12, position: "relative" },
  tabLabel: { fontSize: 15 },
  tabIndicator: { position: "absolute", bottom: -1, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: colors.lavaPink },
  list: { padding: 18, gap: 12, paddingBottom: 40 },
  emptyIcon: { color: colors.ink, fontSize: 48, lineHeight: 52, fontWeight: "900", marginBottom: 12 },
  emptyTitle: { fontSize: 24, marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99 },
})

const ss = StyleSheet.create({
  card: { padding: 18, overflow: "hidden", borderRadius: 30 },
  cardBlob: { position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: "rgba(167,232,238,0.25)" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.86)" },
  iconText: { color: "#91A1B4", fontSize: 20, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 16 },
  desc: { color: "#91A1B4", fontSize: 12, marginTop: 2 },
  reward: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  rewardUnit: { color: "#91A1B4", fontSize: 10 },
  progressTrack: { height: 8, backgroundColor: "rgba(163,177,198,0.18)", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: "rgba(133,245,242,0.95)", borderRadius: 4 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressText: { color: "#91A1B4", fontSize: 11 },
  daysLeft: { color: colors.ink, fontSize: 11, fontWeight: "700" },
})
