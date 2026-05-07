import { useEffect, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { trpc } from "../../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../../src/lib/theme"

export default function VenueReviewScreen() {
  const theme = useTheme()
  const { t } = useTranslation("common")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { id } = useLocalSearchParams<{ id: string }>()

  const venue = trpc.venue.detail.useQuery({ id })
  const myReview = trpc.review.myForVenue.useQuery({ venueId: id })

  const [rating, setRating] = useState(0)
  const [text, setText] = useState("")
  const [error, setError] = useState("")

  // Pre-fill from existing review
  useEffect(() => {
    if (myReview.data) {
      setRating(myReview.data.rating)
      setText(myReview.data.text ?? "")
    }
  }, [myReview.data])

  const upsert = trpc.review.upsert.useMutation({
    onSuccess: () => {
      utils.review.listByVenue.invalidate({ venueId: id })
      utils.review.myForVenue.invalidate({ venueId: id })
      router.back()
    },
    onError: (e) => setError(e.message),
  })

  const remove = trpc.review.delete.useMutation({
    onSuccess: () => {
      utils.review.listByVenue.invalidate({ venueId: id })
      utils.review.myForVenue.invalidate({ venueId: id })
      router.back()
    },
    onError: (e) => setError(e.message),
  })

  function submit() {
    setError("")
    if (rating < 1 || rating > 5) {
      setError(t("ratingRequired", "Tap a star to rate"))
      return
    }
    upsert.mutate({
      venueId: id,
      rating,
      ...(text.trim() ? { text: text.trim() } : {}),
    })
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: myReview.data ? t("editReview", "Edit review") : t("writeReview", "Write review"),
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }} />
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {venue.data ? (
            <>
              <Text style={[s.venueName, { color: theme.text }]}>{venue.data.name}</Text>
              <Text style={[s.venueSub, { color: theme.textSecondary }]}>
                {t(`venue:category.${venue.data.category}`, venue.data.category.toLowerCase())} · {venue.data.city}
              </Text>
            </>
          ) : null}

          <Text style={[s.label, { color: theme.textSecondary }]}>{t("rating", "Rating").toUpperCase()}</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={[s.star, { color: n <= rating ? colors.ink : theme.border }]}>★</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.label, { color: theme.textSecondary }]}>
            {t("yourThoughts", "Your thoughts").toUpperCase()}{" "}
            <Text style={[s.optional, { color: theme.textSecondary }]}>· {t("optional", "optional")}</Text>
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("reviewPlaceholder", "What was your experience?")}
            placeholderTextColor={theme.textSecondary}
            maxLength={1000}
            multiline
            style={[s.input, { borderColor: theme.border, color: theme.text }]}
          />
          <Text style={[s.charCount, { color: theme.textSecondary }]}>{text.length}/1000</Text>

          {error ? <Text style={s.err}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={upsert.isPending}
            style={[s.btn, { backgroundColor: colors.lavaBase, opacity: upsert.isPending ? 0.5 : 1 }]}
          >
            {upsert.isPending ? (
              <ActivityIndicator color={theme.bg} />
            ) : (
              <Text style={{ color: theme.bg, fontWeight: "700", fontSize: 15 }}>
                {myReview.data ? t("updateReview", "Update review") : t("submitReview", "Submit review")}
              </Text>
            )}
          </Pressable>

          {myReview.data ? (
            <Pressable
              onPress={() => remove.mutate({ venueId: id })}
              disabled={remove.isPending}
              style={[s.btn, s.btnGhost, { borderColor: theme.border }]}
            >
              <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 13 }}>
                {remove.isPending ? t("deleting", "Deleting…") : t("deleteReview", "Delete review")}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  venueName: { fontSize: 34, lineHeight: 38, fontFamily: fonts.displayHeavy },
  venueSub: { fontSize: 13, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: "500", letterSpacing: 0 },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 24 },
  star: { fontSize: 44, lineHeight: 48 },
  input: { borderWidth: 1, borderRadius: 24, padding: 14, fontSize: 15, height: 140, textAlignVertical: "top", backgroundColor: "#FFFFFF" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4, marginBottom: 16 },
  err: { color: "#DC2626", fontSize: 13, marginBottom: 8 },
  btn: { padding: 14, borderRadius: 99, alignItems: "center", marginTop: 8 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, marginTop: 12 },
})
