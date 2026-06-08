import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { petStageForPoints, nextPetStage, petProgress, PET_STAGES } from "@pulse/shared"
import { trpc } from "../src/lib/trpc"
import { PET_SPRITES, PixelSprite } from "../src/components/AyooPet"
import { fonts, pass } from "../src/lib/theme"

// Friendly labels + one-liners per stage (display only — logic lives in shared).
const STAGE_LABEL: Record<string, string> = {
  EGG: "Egg", HATCHLING: "Hatchling", KID: "Kid", FOX: "Fox", DRAGON: "Dragon", PHOENIX: "Phoenix",
}
const STAGE_FLAVOR: Record<string, string> = {
  EGG: "Something is stirring inside…",
  HATCHLING: "It hatched! Keep earning to help it grow.",
  KID: "Curious and full of energy.",
  FOX: "Clever and quick on its feet.",
  DRAGON: "Powerful — few reach this far.",
  PHOENIX: "Legendary. The final form.",
}
const labelOf = (key: string) => STAGE_LABEL[key] ?? key
const flavorOf = (key: string) => STAGE_FLAVOR[key] ?? ""

function lifetimeOf(me: { earnedPoints: number; welcomePoints: number; totalEarnedLifetime: number; spentPoints: number } | undefined) {
  if (!me) return 0
  const total = me.earnedPoints + me.welcomePoints
  return Math.max(me.totalEarnedLifetime ?? 0, total + (me.spentPoints ?? 0))
}

// ── Big animated sprite (float + frame toggle) ────────────────
function BigPet({ stageKey, bg }: { stageKey: string; bg: string }) {
  const frames = PET_SPRITES[stageKey] ?? PET_SPRITES.EGG!
  const [frame, setFrame] = useState(0)
  const walk = useRef(new Animated.Value(-1)).current
  const hop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 480)
    return () => clearInterval(id)
  }, [stageKey])

  useEffect(() => {
    const walkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(walk, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    )
    const hopLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: -1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(hop, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.delay(580),
      ])
    )
    walkLoop.start()
    hopLoop.start()
    return () => {
      walkLoop.stop()
      hopLoop.stop()
    }
  }, [stageKey])

  const petX = walk.interpolate({ inputRange: [-1, 1], outputRange: [-28, 28] })
  const petY = hop.interpolate({ inputRange: [-1, 0], outputRange: [-18, 0] })

  return (
    <View style={[s.bigBox, { backgroundColor: bg }]}>
      <Animated.View style={{ transform: [{ translateX: petX }, { translateY: petY }] }}>
        <PixelSprite rows={frames[frame] ?? frames[0]} px={12} />
      </Animated.View>
    </View>
  )
}

export default function PetScreen() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const me = trpc.user.me.useQuery()

  const namePet = trpc.user.namePet.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const ackStage = trpc.user.acknowledgePetStage.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })

  const [nameInput, setNameInput] = useState("")

  const lifetimePoints = lifetimeOf(me.data)
  const stage = petStageForPoints(lifetimePoints)
  const next = nextPetStage(stage)
  const progress = petProgress(lifetimePoints)
  const petName = me.data?.petName ?? null
  const stageSeen = me.data?.petStageSeen ?? 0

  // Celebration: current stage is ahead of what the user has acknowledged.
  const hasNewEvolution = !!me.data && petName != null && stage.index > stageSeen

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: petName ?? "Your pet",
        headerStyle: { backgroundColor: pass.bg },
        headerTintColor: pass.dark,
      }} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <BigPet stageKey={stage.key} bg={stage.bg} />

        {/* Evolution celebration */}
        {hasNewEvolution && (
          <View style={s.evoBanner}>
            <Text style={[s.evoTitle, { fontFamily: fonts.display }]}>
              {stage.key === "HATCHLING" ? "IT HATCHED!" : "EVOLVED!"}
            </Text>
            <Text style={[s.evoSub, { fontFamily: fonts.bodyBold }]}>
              {petName} is now a {labelOf(stage.key)} {stage.index >= 5 ? "✦" : "→"}
            </Text>
            <Pressable
              onPress={() => ackStage.mutate({ stageIndex: stage.index })}
              style={s.evoBtn}
              disabled={ackStage.isPending}
            >
              <Text style={[s.evoBtnText, { fontFamily: fonts.bodyBold }]}>NICE!</Text>
            </Pressable>
          </View>
        )}

        {/* Naming flow (hatching) — only when no name yet */}
        {!petName && me.data && (
          <View style={s.nameCard}>
            <Text style={[s.nameTitle, { fontFamily: fonts.display }]}>NAME YOUR EGG</Text>
            <Text style={[s.nameHint, { fontFamily: fonts.bodyBold }]}>
              Give your companion a name. It grows as you earn points.
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Pixel"
              placeholderTextColor="rgba(0,0,0,0.35)"
              maxLength={20}
              style={[s.input, { fontFamily: fonts.bodyBold }]}
            />
            <Pressable
              onPress={() => namePet.mutate({ name: nameInput.trim() })}
              disabled={nameInput.trim().length === 0 || namePet.isPending}
              style={[s.nameBtn, (nameInput.trim().length === 0 || namePet.isPending) && s.nameBtnDisabled]}
            >
              <Text style={[s.nameBtnText, { fontFamily: fonts.bodyBold }]}>HATCH 🥚</Text>
            </Pressable>
          </View>
        )}

        {/* Status */}
        {petName && (
          <>
            <Text style={[s.stageName, { fontFamily: fonts.display }]}>{labelOf(stage.key).toUpperCase()}</Text>
            <Text style={[s.flavor, { fontFamily: fonts.bodyBold }]}>{flavorOf(stage.key)}</Text>

            {next ? (
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <Text style={[s.progressLabel, { fontFamily: fonts.bodyBold }]}>
                  {Math.max(0, next.threshold - lifetimePoints)} pts → {labelOf(next.key)}
                </Text>
              </View>
            ) : (
              <Text style={[s.maxLabel, { fontFamily: fonts.bodyBold }]}>✦ MAX EVOLUTION REACHED</Text>
            )}
          </>
        )}

        {/* Evolution timeline */}
        <Text style={[s.timelineHead, { fontFamily: fonts.display }]}>EVOLUTION</Text>
        <View style={s.timeline}>
          {PET_STAGES.map((st) => {
            const unlocked = lifetimePoints >= st.threshold
            const current = st.index === stage.index
            return (
              <View key={st.key} style={[s.row, current && s.rowCurrent]}>
                <View style={[s.rowSprite, { backgroundColor: unlocked ? st.bg : "#E5E3DD" }]}>
                  {unlocked
                    ? <PixelSprite rows={(PET_SPRITES[st.key] ?? PET_SPRITES.EGG!)[0]} px={3} />
                    : <Text style={s.lock}>🔒</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowName, { fontFamily: fonts.bodyBold }, !unlocked && s.rowLocked]}>
                    {labelOf(st.key)}
                  </Text>
                  <Text style={[s.rowThreshold, { fontFamily: fonts.bodyBold }]}>
                    {st.threshold === 0 ? "Start" : `${st.threshold} pts`}
                  </Text>
                </View>
                {current && <Text style={[s.rowBadge, { fontFamily: fonts.bodyBold }]}>NOW</Text>}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: pass.bg },
  content: { padding: 18, paddingBottom: 60, alignItems: "center" },

  bigBox: {
    width: 260,
    height: 204,
    borderWidth: 4,
    borderColor: pass.dark,
    borderRadius: 8,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: pass.dark,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },

  // Celebration
  evoBanner: {
    width: "100%",
    backgroundColor: "#FFF0A0",
    borderWidth: 3,
    borderColor: pass.dark,
    borderRadius: 8,
    padding: 18,
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  evoTitle: { fontSize: 26, color: pass.dark, letterSpacing: 0 },
  evoSub: { fontSize: 13, color: pass.dark },
  evoBtn: {
    marginTop: 4,
    backgroundColor: pass.dark,
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  evoBtnText: { color: "#fff", fontSize: 14, letterSpacing: 1 },

  // Naming
  nameCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: pass.dark,
    borderRadius: 8,
    padding: 18,
    gap: 10,
    marginBottom: 18,
  },
  nameTitle: { fontSize: 22, color: pass.dark },
  nameHint: { fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 17 },
  input: {
    borderWidth: 2,
    borderColor: pass.dark,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: pass.dark,
    backgroundColor: pass.bg,
  },
  nameBtn: {
    backgroundColor: "#ea5b0c",
    borderWidth: 2,
    borderColor: pass.dark,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: "center",
  },
  nameBtnDisabled: { opacity: 0.4 },
  nameBtnText: { color: "#fff", fontSize: 15, letterSpacing: 1 },

  // Status
  stageName: { fontSize: 30, color: pass.dark, letterSpacing: 0, marginBottom: 4 },
  flavor: { fontSize: 13, color: "rgba(0,0,0,0.55)", textAlign: "center", marginBottom: 16 },

  progressWrap: { width: "100%", gap: 6, marginBottom: 24 },
  progressTrack: {
    height: 14,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 7,
    borderWidth: 2,
    borderColor: pass.dark,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#273AA8" },
  progressLabel: { fontSize: 11, color: "rgba(0,0,0,0.6)", textAlign: "center", letterSpacing: 0.5 },

  maxLabel: { fontSize: 13, color: "#806828", marginBottom: 24 },

  // Timeline
  timelineHead: { fontSize: 18, color: pass.dark, alignSelf: "flex-start", marginBottom: 12 },
  timeline: { width: "100%", gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: pass.dark,
    borderRadius: 8,
    padding: 12,
  },
  rowCurrent: { backgroundColor: "#FFF5D6", borderWidth: 3 },
  rowSprite: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: pass.dark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lock: { fontSize: 16 },
  rowName: { fontSize: 15, color: pass.dark },
  rowLocked: { color: "rgba(0,0,0,0.35)" },
  rowThreshold: { fontSize: 11, color: "rgba(0,0,0,0.5)", marginTop: 2 },
  rowBadge: {
    fontSize: 10,
    color: "#fff",
    backgroundColor: "#ea5b0c",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    letterSpacing: 1,
  },
})
