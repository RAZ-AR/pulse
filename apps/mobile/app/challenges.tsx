import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useRouter } from "expo-router"
import { trpc } from "../src/lib/trpc"
import { colors, useTheme } from "../src/lib/theme"

type Tab = "mine" | "available"

const TYPE_LABELS: Record<string, string> = {
  SPEND_AMOUNT: "💸 Spend",
  VISIT_N_VENUES: "📍 Visit",
  WALK_STEPS: "👟 Steps",
  COMBO: "🎯 Combo",
  STREAK: "🔥 Streak",
}

function daysLeft(end: Date | string): number {
  const ms = new Date(end).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default function ChallengesScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("mine")

  const mine = trpc.challenge.listMine.useQuery()
  const available = trpc.challenge.listAvailable.useQuery()

  const mineCount = mine.data?.length ?? 0
  const availCount = available.data?.length ?? 0

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: t("nav.challenges", "Challenges"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        {/* Tabs */}
        <View style={[s.tabBar, { borderBottomColor: theme.border }]}>
          <TabButton
            label={t("myChallenges", "Mine")}
            count={mineCount}
            active={tab === "mine"}
            onPress={() => setTab("mine")}
            theme={theme}
          />
          <TabButton
            label={t("availableChallenges", "Available")}
            count={availCount}
            active={tab === "available"}
            onPress={() => setTab("available")}
            theme={theme}
          />
        </View>

        <ScrollView contentContainerStyle={s.list}>
          {tab === "mine" ? (
            mineCount === 0 ? (
              <Empty
                emoji="🎯"
                title={t("noJoined", "No active challenges")}
                desc={t("noJoinedDesc", "Pick one from Available to start earning bonus points")}
                action={t("browseAvailable", "Browse available")}
                onAction={() => setTab("available")}
                theme={theme}
              />
            ) : (
              (mine.data ?? []).map((uc) => {
                const c = uc.challenge
                const target = (c.rules as { threshold?: number; count?: number; days?: number })
                const total = target.threshold ?? target.count ?? target.days ?? 1
                const pct = uc.isCompleted ? 100 : Math.min(100, (uc.progress / total) * 100)
                return (
                  <Pressable
                    key={uc.id}
                    onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: c.id } })}
                    style={[s.card, { backgroundColor: theme.surface, borderColor: uc.isCompleted ? colors.mint : theme.border }]}
                  >
                    <View style={s.cardHead}>
                      <Text style={[s.typeTag, { color: theme.textSecondary }]}>
                        {TYPE_LABELS[c.type] ?? c.type}
                      </Text>
                      <Text style={[s.daysLeft, { color: theme.textSecondary }]}>
                        {daysLeft(c.endDate)}d {t("left", "left")}
                      </Text>
                    </View>
                    <Text style={[s.title, { color: theme.text }]}>{c.title}</Text>
                    <Text style={[s.desc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {c.description}
                    </Text>

                    {/* Progress */}
                    <View style={s.progressRow}>
                      <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
                        <View
                          style={[
                            s.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: uc.isCompleted ? colors.mint : colors.pink,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.progressText, { color: theme.text }]}>
                        {uc.isCompleted ? `✓ ${t("done", "Done")}` : `${uc.progress} / ${total}`}
                      </Text>
                    </View>

                    <View style={[s.footer, { borderTopColor: theme.border }]}>
                      <Text style={[s.reward, { color: colors.mint }]}>+{c.pointsReward} pts</Text>
                      {uc.isCompleted ? (
                        <Text style={[s.completed, { color: colors.mint }]}>
                          ✓ {t("completed", "Completed")}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                )
              })
            )
          ) : availCount === 0 ? (
            <Empty
              emoji="🌱"
              title={t("noAvailable", "All caught up!")}
              desc={t("noAvailableDesc", "You've joined every active challenge. New ones drop monthly.")}
              theme={theme}
            />
          ) : (
            (available.data ?? []).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: c.id } })}
                style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={s.cardHead}>
                  <Text style={[s.typeTag, { color: theme.textSecondary }]}>
                    {TYPE_LABELS[c.type] ?? c.type}
                  </Text>
                  <Text style={[s.daysLeft, { color: theme.textSecondary }]}>
                    {daysLeft(c.endDate)}d {t("left", "left")}
                  </Text>
                </View>
                <Text style={[s.title, { color: theme.text }]}>{c.title}</Text>
                <Text style={[s.desc, { color: theme.textSecondary }]} numberOfLines={3}>
                  {c.description}
                </Text>
                <View style={[s.footer, { borderTopColor: theme.border }]}>
                  <Text style={[s.reward, { color: colors.mint }]}>+{c.pointsReward} pts</Text>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
                    {t("tapToJoin", "Tap to join")} →
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </>
  )
}

function TabButton({
  label, count, active, onPress, theme,
}: { label: string; count: number; active: boolean; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable onPress={onPress} style={s.tab}>
      <Text
        style={[
          s.tabLabel,
          { color: active ? theme.text : theme.textSecondary, fontWeight: active ? "700" : "500" },
        ]}
      >
        {label}{" "}
        <Text style={{ color: theme.textSecondary, fontWeight: "500" }}>{count}</Text>
      </Text>
      {active ? <View style={[s.tabIndicator, { backgroundColor: theme.text }]} /> : null}
    </Pressable>
  )
}

function Empty({
  emoji, title, desc, action, onAction, theme,
}: {
  emoji: string
  title: string
  desc: string
  action?: string
  onAction?: () => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={s.emptyEmoji}>{emoji}</Text>
      <Text style={[s.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>{desc}</Text>
      {action ? (
        <Pressable onPress={onAction} style={[s.emptyBtn, { backgroundColor: theme.text }]}>
          <Text style={{ color: theme.bg, fontWeight: "700" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tab: { paddingVertical: 14, paddingHorizontal: 16, position: "relative" },
  tabLabel: { fontSize: 14 },
  tabIndicator: { position: "absolute", left: 16, right: 16, bottom: -1, height: 2, borderRadius: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeTag: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  daysLeft: { fontSize: 11, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: "700", minWidth: 60, textAlign: "right" },
  footer: { borderTopWidth: 1, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reward: { fontSize: 14, fontWeight: "800" },
  completed: { fontSize: 11, fontWeight: "700" },
  empty: { padding: 32, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
})
