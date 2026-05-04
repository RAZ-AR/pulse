import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { fonts, gradients, useTheme, type Theme } from "../src/lib/theme"
import { NeuCard, GradPill } from "../src/components/neu"

const CHALLENGE_GRADS = [gradients.rainbow2, gradients.pink, gradients.rainbow3, gradients.blue] as const

const TYPE_LABELS: Record<string, string> = {
  SPEND_AMOUNT: "💸 Spend",
  VISIT_N_VENUES: "📍 Visit",
  WALK_STEPS: "👟 Steps",
  COMBO: "🎯 Combo",
  STREAK: "🔥 Streak",
}

type Tab = "mine" | "available"

function daysLeft(end: Date | string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000))
}

export default function ChallengesScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
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
                emoji="🎯"
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
                const grad = uc.isCompleted ? gradients.mint : CHALLENGE_GRADS[i % CHALLENGE_GRADS.length]!
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
                  />
                )
              })
            )
          ) : availableList.length === 0 ? (
            <Empty
              emoji="🌱"
              title={t("noAvailable", "All caught up!")}
              desc={t("noAvailableDesc", "You've joined every active challenge.")}
              theme={theme}
            />
          ) : (
            availableList.map((c, i) => {
              const target = c.rules as { threshold?: number; count?: number; days?: number }
              const total = target.threshold ?? target.count ?? target.days ?? 1
              const sponsored = c.venue !== null
              const grad = sponsored ? gradients.pink : CHALLENGE_GRADS[i % CHALLENGE_GRADS.length]!
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
  grad, type, title, description, pointsReward, progress, total, pct, daysLeft, completed, sponsorName, onPress,
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
}) {
  return (
    <NeuCard gradient={grad} onPress={onPress} style={ss.card}>
      <View style={ss.cardBlob} />
      <View style={ss.cardHead}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={ss.icon}>
            <Text style={{ fontSize: 22 }}>{type === "SPEND_AMOUNT" ? "💸" : type === "VISIT_N_VENUES" ? "📍" : type === "STREAK" ? "🔥" : "🎯"}</Text>
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
            <View style={[ss.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={ss.cardFoot}>
            <Text style={ss.progressText}>{progress ?? 0} / {total}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {sponsorName ? <GradPill label={sponsorName} gradient={gradients.gold} /> : null}
              <Text style={ss.daysLeft}>{completed ? "✓ Done!" : `${daysLeft}d left`}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={[ss.cardFoot, { marginTop: 6 }]}>
          {sponsorName ? <GradPill label={sponsorName} gradient={gradients.gold} /> : <View />}
          <Text style={ss.daysLeft}>{daysLeft}d left · Tap to join →</Text>
        </View>
      )}
    </NeuCard>
  )
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
  emoji, title, desc, action, onAction, theme,
}: { emoji: string; title: string; desc: string; action?: string; onAction?: () => void; theme: Theme }) {
  return (
    <NeuCard style={{ padding: 28, alignItems: "center" }}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</Text>
      <Text style={[s.emptyTitle, { color: theme.text, fontFamily: fonts.displayHeavy }]}>{title}</Text>
      <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>{desc}</Text>
      {action ? (
        <Pressable onPress={onAction} style={[s.emptyBtn, { backgroundColor: theme.text }]}>
          <Text style={{ color: theme.bg, fontFamily: fonts.bodyBold, fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </NeuCard>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 6, gap: 24 },
  tab: { paddingVertical: 12, position: "relative" },
  tabLabel: { fontSize: 15 },
  tabIndicator: {
    position: "absolute", bottom: -1, left: 0, right: 0, height: 3, borderRadius: 2,
    backgroundColor: "#FFB3E6",
  },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  emptyTitle: { fontSize: 16, marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
})

const ss = StyleSheet.create({
  card: { padding: 18, overflow: "hidden" },
  cardBlob: { position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.1)" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFF", fontSize: 15, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  desc: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  reward: { color: "#FFF", fontSize: 18, lineHeight: 20, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rewardUnit: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 4 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressText: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  daysLeft: { color: "#FFF", fontSize: 11, fontWeight: "700" },
})
