import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, useTheme } from "../../src/lib/theme"

export default function VenueDetailScreen() {
  const theme = useTheme()
  const { t } = useTranslation("venue")
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const venue = trpc.venue.detail.useQuery({ id })
  const reviews = trpc.review.listByVenue.useQuery({ venueId: id, limit: 10 })

  if (venue.isLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary }}>{t("common:loading", "Loading…")}</Text>
      </View>
    )
  }

  const v = venue.data
  if (!v) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text }}>{t("notFound", "Venue not found")}</Text>
      </View>
    )
  }

  const boostActive = v.boostUntil && new Date(v.boostUntil) > new Date()
  const effectiveRate = v.pointsPerCurrency
    ? v.pointsPerCurrency * (boostActive ? (v.boostMultiplier ?? 1) : 1)
    : null

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: v.name, headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.text }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Hero */}
        <View style={s.heroNameRow}>
          <Text style={[s.name, { color: theme.text }]}>{v.name}</Text>
          {v.subscriptionTier === "FEATURED" ? (
            <Text style={s.featuredBadge}>★ FEATURED</Text>
          ) : null}
        </View>
        <Text style={[s.subtle, { color: theme.textSecondary }]}>
          {v.category.toLowerCase()} · {v.city}
        </Text>
        {v.address ? (
          <Text style={[s.subtle, { color: theme.textSecondary, marginTop: 2 }]}>{v.address}</Text>
        ) : null}

        {/* Points rate hero — main differentiator */}
        {v.isPartner && effectiveRate ? (
          <View style={[s.rateCard, { backgroundColor: colors.pink }]}>
            <Text style={s.rateLabel}>{t("pointsRate", "Points rate").toUpperCase()}</Text>
            <Text style={s.rateValue}>{effectiveRate.toFixed(3)}</Text>
            <Text style={s.rateUnit}>{t("perCurrency", "pts per RSD")}</Text>
            {boostActive ? (
              <Text style={s.boost}>×{v.boostMultiplier} {t("boostActive", "BOOST ACTIVE")}</Text>
            ) : null}
          </View>
        ) : (
          <View style={[s.notPartner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {t("notPartner", "Not a PULSE partner yet — receipt scans only")}
            </Text>
          </View>
        )}

        {/* Description */}
        {v.description ? (
          <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>
              {t("about", "About").toUpperCase()}
            </Text>
            <Text style={[s.body, { color: theme.text }]}>{v.description}</Text>
          </View>
        ) : null}

        {/* Rewards */}
        {v.rewards.length > 0 ? (
          <>
            <Text style={[s.heading, { color: theme.textSecondary }]}>
              {t("availableRewards", "Available rewards").toUpperCase()}
            </Text>
            <View style={s.rewardsList}>
              {v.rewards.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
                  style={[s.rewardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rewardTitle, { color: theme.text }]}>{r.title}</Text>
                    {r.description ? (
                      <Text style={[s.rewardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {r.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[s.rewardCost, { color: colors.mint }]}>{r.pointsCost} pts</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={[s.subtle, { color: theme.textSecondary, textAlign: "center", marginTop: 20 }]}>
            {t("noRewardsYet", "No rewards yet at this venue")}
          </Text>
        )}

        {/* Reviews */}
        <View style={s.reviewsHeader}>
          <Text style={[s.heading, { color: theme.textSecondary, marginBottom: 0 }]}>
            {t("reviews", "Reviews").toUpperCase()}
            {reviews.data?.averageRating != null ? (
              <Text style={{ color: theme.text }}>{"  "}★ {reviews.data.averageRating.toFixed(1)} · {reviews.data.count}</Text>
            ) : null}
          </Text>
          <Pressable onPress={() => router.push({ pathname: "/venue/[id]/review", params: { id: v.id } })}>
            <Text style={[s.writeBtn, { color: theme.text }]}>
              {t("writeReview", "Write review")} →
            </Text>
          </Pressable>
        </View>

        {!reviews.data || reviews.data.reviews.length === 0 ? (
          <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border, alignItems: "center" }]}>
            <Text style={[s.subtle, { color: theme.textSecondary }]}>
              {t("noReviewsYet", "Be the first to leave a review")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {reviews.data.reviews.map((r) => (
              <View key={r.id} style={[s.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={s.reviewHead}>
                  <Text style={[s.reviewAuthor, { color: theme.text }]} numberOfLines={1}>
                    {r.user.name ?? "Anonymous"}
                  </Text>
                  <Text style={s.reviewStars}>{"★".repeat(r.rating)}<Text style={{ color: theme.textSecondary }}>{"★".repeat(5 - r.rating)}</Text></Text>
                </View>
                {r.text ? (
                  <Text style={[s.reviewText, { color: theme.text }]}>{r.text}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 26, fontWeight: "800" },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  featuredBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: "#FFF", backgroundColor: "#FF4D8F", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, overflow: "hidden" },
  subtle: { fontSize: 13, marginTop: 4 },
  rateCard: { padding: 24, borderRadius: 16, alignItems: "center", marginTop: 20, marginBottom: 20 },
  rateLabel: { color: "#FFF", fontSize: 11, fontWeight: "700", letterSpacing: 1, opacity: 0.85 },
  rateValue: { color: "#FFF", fontSize: 56, fontWeight: "800", marginTop: 4 },
  rateUnit: { color: "#FFF", fontSize: 13, opacity: 0.85 },
  boost: { color: "#FFF", fontSize: 12, fontWeight: "700", marginTop: 8, padding: 6, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, overflow: "hidden" },
  notPartner: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", marginTop: 20, marginBottom: 20 },
  section: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 20 },
  heading: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  rewardsList: { gap: 8 },
  rewardCard: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rewardTitle: { fontSize: 14, fontWeight: "700" },
  rewardDesc: { fontSize: 12, marginTop: 2 },
  rewardCost: { fontSize: 14, fontWeight: "800" },
  reviewsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 8, paddingHorizontal: 4 },
  writeBtn: { fontSize: 12, fontWeight: "700" },
  reviewCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reviewAuthor: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  reviewStars: { fontSize: 13, color: "#FF4D8F" },
  reviewText: { fontSize: 13, lineHeight: 18 },
})
