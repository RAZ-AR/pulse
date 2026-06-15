import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { PET_COLLECTION, currentPet } from "@pulse/shared"
import { trpc } from "../src/lib/trpc"
import { useTheme, fonts } from "../src/lib/theme"
import { PetIcon } from "../src/components/AyooPet"
import { petDefaultName } from "../src/components/Tamagotchi"

function fmt(n: number) {
  return n.toLocaleString()
}

export default function PetScreen() {
  const theme = useTheme()
  const router = useRouter()
  const utils = trpc.useUtils()
  const me = trpc.user.me.useQuery()

  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const lifetimePoints = Math.max(me.data?.totalEarnedLifetime ?? 0, total + (me.data?.spentPoints ?? 0))
  const pet = currentPet(lifetimePoints, true)
  const petKey = pet?.key ?? "HATCHLING"

  const namePet = trpc.user.namePet.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  })
  const [name, setName] = useState(me.data?.petName ?? "")
  const placeholder = petDefaultName(petKey)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.back}>
        <Text style={[s.backText, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>← Назад</Text>
      </Pressable>

      <Text style={[s.title, { color: theme.text, fontFamily: fonts.displayHeavy }]}>Питомцы</Text>
      <Text style={[s.sub, { color: theme.textSecondary }]}>Зарабатывай баллы — открывай новых питомцев</Text>

      {/* Current pet + rename */}
      <View style={[s.card, theme.shadowRaisedSm]}>
        <View style={s.heroPet}>
          <PetIcon petKey={petKey} px={7} />
        </View>
        <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>ИМЯ ПИТОМЦА</Text>
        <View style={[s.inputWrap, { borderColor: theme.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            maxLength={20}
            style={[s.input, { color: theme.text, fontFamily: fonts.body }]}
          />
        </View>
        <Pressable
          onPress={() => namePet.mutate({ name: (name.trim() || placeholder) })}
          disabled={namePet.isPending}
          style={[s.saveBtn, { backgroundColor: theme.text }]}
        >
          <Text style={[s.saveText, { color: theme.bg, fontFamily: fonts.displayHeavy }]}>
            {namePet.isPending ? "..." : namePet.isSuccess ? "Сохранено ✓" : "Сохранить"}
          </Text>
        </Pressable>
      </View>

      {/* Collection */}
      <Text style={[s.label, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginTop: 8 }]}>КОЛЛЕКЦИЯ</Text>
      {PET_COLLECTION.map((p) => {
        const unlocked = lifetimePoints >= p.threshold
        const isCurrent = p.key === petKey
        return (
          <View key={p.key} style={[s.row, theme.shadowRaisedSm, isCurrent && { borderWidth: 2, borderColor: theme.text }]}>
            <View style={[s.rowIcon, !unlocked && s.locked]}>
              <PetIcon petKey={p.key} px={3} />
            </View>
            <View style={s.rowMain}>
              <Text style={[s.rowName, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
                {petDefaultName(p.key)}
              </Text>
              <Text style={[s.rowThreshold, { color: theme.textMuted, fontFamily: fonts.body }]}>
                {fmt(p.threshold)} баллов
              </Text>
            </View>
            <Text style={[s.rowState, { fontFamily: fonts.bodyBold, color: unlocked ? "#015634" : theme.textMuted }]}>
              {unlocked ? "✓" : "🔒"}
            </Text>
          </View>
        )
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 24, gap: 12 },
  back: { paddingVertical: 6 },
  backText: { fontSize: 15 },
  title: { fontSize: 30, marginTop: 4 },
  sub: { fontSize: 14, marginBottom: 8 },

  card: { borderRadius: 24, padding: 20, backgroundColor: "#FFFFFF", gap: 10, alignItems: "stretch" },
  heroPet: { alignItems: "center", justifyContent: "center", marginBottom: 8 },
  label: { fontSize: 11, letterSpacing: 0.5 },
  inputWrap: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.6)" },
  input: { height: 46, fontSize: 16 },
  saveBtn: { borderRadius: 99, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveText: { fontSize: 15 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  rowIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  locked: { opacity: 0.25 },
  rowMain: { flex: 1 },
  rowName: { fontSize: 16 },
  rowThreshold: { fontSize: 13, marginTop: 2 },
  rowState: { fontSize: 18 },
})
