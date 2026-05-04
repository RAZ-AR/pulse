import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { fonts, gradients, useTheme, type Theme } from "../../src/lib/theme"
import { NeuCard, GradPill } from "../../src/components/neu"

const REWARD_GRADS = [gradients.rainbow2, gradients.pink, gradients.blue, gradients.mint] as const

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
      <Stack.Screen options={{
        headerShown: true,
        title: v.name,
        headerStyle: { backgroundColor: theme.bg }, headerShadowVisible: false,
        headerTintColor: theme.text,
      }} />
      <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
        {/* Title */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: theme.text, fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
              {v.name}
            </Text>
            <Text style={[s.subtle, { color: theme.textSecondary }]}>
              {v.category.toLowerCase()} · {v.city}
            </Text>
            {v.address ? (
              <Text style={[s.subtle, { color: theme.textSecondary, marginTop: 2 }]}>{v.address}</Text>
            ) : null}
          </View>
          {v.subscriptionTier === "FEATURED" ? (
            <GradPill label="★ FEATURED" gradient={gradients.gold} />
          ) : null}
        </View>

        {/* Points rate hero */}
        {v.isPartner && effectiveRate ? (
          <NeuCard gradient={gradients.rainbow} style={s.rateCard}>
            <View style={s.heroBlob} />
            <Text style={[s.rateLabel, { fontFamily: fonts.bodyBold }]}>
              {t("pointsRate", "Points rate").toUpperCase()}
            </Text>
            <Text style={[s.rateValue, { fontFamily: fonts.displayHeavy }]}>{effectiveRate.toFixed(3)}</Text>
            <Text style={s.rateUnit}>{t("perCurrency", "pts per RSD")}</Text>
            {boostActive ? (
              <View style={s.boostBadge}>
                <Text style={[s.boostText, { fontFamily: fonts.bodyBold }]}>
                  ×{v.boostMultiplier} {t("boostActive", "BOOST ACTIVE")}
                </Text>
              </View>
            ) : null}
          </NeuCard>
        ) : (
          <NeuCard style={{ padding: 16, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
              {t("notPartner", "Not a PULSE partner yet — receipt scans only")}
            </Text>
          </NeuCard>
        )}

        {/* Description */}
        {v.description ? (
          <NeuCard style={{ padding: 16, marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
              {t("about", "About").toUpperCase()}
            </Text>
            <Text style={[s.body, { color: theme.text }]}>{v.description}</Text>
          </NeuCard>
        ) : null}

        {/* Rewards */}
        {v.rewards.length > 0 ? (
          <>
            <Text style={[s.heading, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
              {t("availableRewards", "Available rewards")}
            </Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {v.rewards.map((r, i) => {
                const grad = REWARD_GRADS[i % REWARD_GRADS.length]!
                return (
                  <NeuCard
                    key={r.id}
                    gradient={grad}
                    onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
                    style={s.rewardRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rewardTitle, { fontFamily: fonts.bodyBold }]}>{r.title}</Text>
                      {r.description ? (
                        <Text style={s.rewardDesc} numberOfLines={1}>{r.description}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.rewardCost, { fontFamily: fonts.displayHeavy }]}>{r.pointsCost}</Text>
                      <Text style={s.rewardCostUnit}>pts</Text>
                    </View>
                  </NeuCard>
                )
              })}
            </View>
          </>
        ) : (
          <Text style={[s.subtle, { color: theme.textSecondary, textAlign: "center", marginVertical: 12 }]}>
            {t("noRewardsYet", "No rewards yet at this venue")}
          </Text>
        )}

        {/* Reviews */}
        <View style={s.reviewsHead}>
          <Text style={[s.heading, { color: theme.text, fontFamily: fonts.displayHeavy, marginBottom: 0 }]}>
            {t("reviews", "Reviews")}
            {reviews.data?.averageRating != null ? (
              <Text style={{ color: theme.textSecondary, fontSize: 14, fontFamily: fonts.body }}>
                {"  "}★ {reviews.data.averageRating.toFixed(1)} · {reviews.data.count}
              </Text>
            ) : null}
          </Text>
          <Pressable onPress={() => router.push({ pathname: "/venue/[id]/review", params: { id: v.id } })}>
            <Text style={[s.writeBtn, { color: theme.text, fontFamily: fonts.bodyBold }]}>
              {t("writeReview", "Write review")} →
            </Text>
          </Pressable>
        </View>

        {!reviews.data || reviews.data.reviews.length === 0 ? (
          <NeuCard style={{ padding: 18, alignItems: "center" }}>
            <Text style={{ color: theme.textSecondary }}>
              {t("noReviewsYet", "Be the first to leave a review")}
            </Text>
          </NeuCard>
        ) : (
          <View style={{ gap: 8 }}>
            {reviews.data.reviews.map((r) => (
              <NeuCard key={r.id} style={{ padding: 14 }}>
                <View style={s.reviewHead}>
                  <Text style={[s.reviewAuthor, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {r.user.name ?? "Anonymous"}
                  </Text>
                  <Text style={s.reviewStars}>{"★".repeat(r.rating)}<Text style={{ color: theme.textMuted }}>{"★".repeat(5 - r.rating)}</Text></Text>
                </View>
                {r.text ? <Text style={[s.reviewText, { color: theme.text }]}>{r.text}</Text> : null}
              </NeuCard>
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

  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  name: { fontSize: 26, lineHeight: 30 },
  subtle: { fontSize: 13, marginTop: 4 },

  rateCard: { padding: 24, alignItems: "center", marginBottom: 16, overflow: "hidden" },
  heroBlob: { position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.12)" },
  rateLabel: { color: "rgba(255,255,255,0.78)", fontSize: 11, letterSpacing: 1.5 },
  rateValue: { color: "#FFF", fontSize: 56, lineHeight: 60, marginTop: 4, textShadowColor: "rgba(0,0,0,0.12)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  rateUnit: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  boostBadge: { marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  boostText: { color: "#FFF", fontSize: 11 },

  sectionLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20 },

  heading: { fontSize: 18, marginBottom: 12 },

  rewardRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rewardTitle: { color: "#FFF", fontSize: 14, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rewardDesc: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 2 },
  rewardCost: { color: "#FFF", fontSize: 18, lineHeight: 20, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  rewardCostUnit: { color: "rgba(255,255,255,0.7)", fontSize: 10 },

  reviewsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 },
  writeBtn: { fontSize: 12 },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reviewAuthor: { fontSize: 14, flex: 1, marginRight: 8 },
  reviewStars: { fontSize: 13, color: "#FF85D2" },
  reviewText: { fontSize: 13, lineHeight: 18 },
})
