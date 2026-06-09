import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, gradients, neonColors, useTheme, type Theme } from "../../src/lib/theme"
import { useColorMode } from "../../src/store/colorMode"
import { NeuCard, GradPill, VolumeGradient } from "../../src/components/neu"
import { DEMO_VENUES } from "../../src/lib/venues"

const REWARD_GRADS = [gradients.black, gradients.graphite, gradients.black, gradients.graphite] as const
const REWARD_RAINBOW = [
  ["#8B3DFF", "#2B6EFF"] as const,
  ["#2B6EFF", "#00F5FF"] as const,
  ["#FF2D9B", "#8B3DFF"] as const,
  ["#00F5FF", "#2B6EFF"] as const,
]

type DetailVenue = {
  id: string
  name: string
  category: string
  description: string | null
  address: string
  city: string
  country: string
  isPartner: boolean
  pointsPerCurrency: number | null
  currency: string | null
  boostUntil: Date | string | null
  boostMultiplier: number | null
  subscriptionTier: string | null
  enableDiscount: boolean
  maxDiscountPercent: number
  googleRating: number | null
  googleReviews: number | null
  sourceProvider?: string | null
  sourcePlaceId?: string | null
  sourceUrl?: string | null
  sourceUpdatedAt?: Date | string | null
  rewards?: {
    id: string
    title: string
    description: string | null
    pointsCost: number
  }[]
  phone?: string | null
  website?: string | null
  instagram?: string | null
  openingHours?: string | null
  openingHoursText?: string | null
  sourceLabel?: string
  specialOffers?: string[] | unknown
}

function isDemoVenue(venue: DetailVenue) {
  return venue.id.startsWith("demo_")
}

function venueOffers(venue: DetailVenue) {
  const offers: string[] = []
  if (Array.isArray(venue.specialOffers)) {
    offers.push(...venue.specialOffers.filter((offer): offer is string => typeof offer === "string" && offer.trim().length > 0))
  }
  if (venue.enableDiscount && venue.maxDiscountPercent > 0) offers.push(`-${venue.maxDiscountPercent}% welcome discount`)
  if (venue.isPartner && venue.pointsPerCurrency) offers.push("Partner points on every purchase")
  return Array.from(new Set(offers)).slice(0, 4)
}

function contactRows(venue: DetailVenue) {
  return [
    venue.phone ? { label: "Phone", value: venue.phone, url: `tel:${venue.phone.replace(/\s/g, "")}` } : null,
    venue.website ? { label: "Website", value: venue.website.replace(/^https?:\/\//, ""), url: venue.website } : null,
    venue.instagram ? { label: "Instagram", value: venue.instagram.replace(/^https?:\/\/instagram\.com\//, "@"), url: venue.instagram } : null,
    venue.openingHoursText ? { label: "Hours", value: venue.openingHoursText } : null,
    venue.openingHours ? { label: "Hours", value: venue.openingHours } : null,
  ].filter(Boolean) as { label: string; value: string; url?: string }[]
}

function sourceLabel(venue: DetailVenue) {
  if (venue.sourceLabel) return venue.sourceLabel
  if (venue.sourceProvider === "google_maps") return "Google Maps public profile"
  if (venue.sourceProvider) return `${venue.sourceProvider} public profile`
  return "ayoo partner profile"
}

export default function VenueDetailScreen() {
  const theme = useTheme()
  const { mode } = useColorMode()
  const isRainbow = mode === "rainbow"
  const { t } = useTranslation("venue")
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const venue = trpc.venue.detail.useQuery({ id })
  const reviews = trpc.review.listByVenue.useQuery({ venueId: id, limit: 10 })
  const partnerOffers = trpc.offer.list.useQuery(
    { venueId: id, limit: 10 },
    { enabled: !id.startsWith("demo_") }
  )
  const demoVenue = DEMO_VENUES.find((item) => item.id === id)

  if (venue.isLoading && !demoVenue) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary }}>{t("common:loading", "Loading…")}</Text>
      </View>
    )
  }

  const v = (venue.data ?? demoVenue) as DetailVenue | undefined
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
  const rewards = v.rewards ?? []
  const offers = venueOffers(v)
  const activeOffers = partnerOffers.data?.offers ?? []
  const contacts = contactRows(v)
  const importSourceLabel = sourceLabel(v)

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
            {v.googleRating ? (
              <Text style={[s.rating, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                Google {v.googleRating.toFixed(1)} · {v.googleReviews ?? 0} reviews
              </Text>
            ) : null}
            {v.address ? (
              <Text style={[s.subtle, { color: theme.textSecondary, marginTop: 2 }]}>{v.address}</Text>
            ) : null}
          </View>
          {v.subscriptionTier === "FEATURED" ? (
            <GradPill label={`★ ${t("featured")}`} gradient={gradients.gold} />
          ) : null}
        </View>

        {/* Points rate hero */}
        {v.isPartner && effectiveRate ? (
          isRainbow ? (
            <VolumeGradient colors={["#8B3DFF", "#2B6EFF", "#00F5FF"]} shadowColor="#8B3DFF" shadowOpacity={0.35} borderRadius={32} style={[s.rateCard, { marginBottom: 16 }]}>
              <Text style={[s.rateLabel, { fontFamily: fonts.bodyBold, color: "rgba(255,255,255,0.7)" }]}>
                {t("pointsRate", "Points rate").toUpperCase()}
              </Text>
              <Text style={[s.rateValue, { fontFamily: fonts.displayHeavy, color: "#FFFFFF" }]}>{effectiveRate.toFixed(3)}</Text>
              <Text style={[s.rateUnit, { color: "rgba(255,255,255,0.65)" }]}>{t("perCurrency", "pts per RSD")}</Text>
              {boostActive ? (
                <View style={[s.boostBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={[s.boostText, { fontFamily: fonts.bodyBold, color: "#FFFFFF" }]}>
                    ×{v.boostMultiplier} {t("boostActiveLabel")}
                  </Text>
                </View>
              ) : null}
            </VolumeGradient>
          ) : (
            <NeuCard gradient={gradients.black} style={s.rateCard}>
              <View style={s.heroBlob} />
              <Text style={[s.rateLabel, { fontFamily: fonts.bodyBold }]}>
                {t("pointsRate", "Points rate").toUpperCase()}
              </Text>
              <Text style={[s.rateValue, { fontFamily: fonts.displayHeavy }]}>{effectiveRate.toFixed(3)}</Text>
              <Text style={s.rateUnit}>{t("perCurrency", "pts per RSD")}</Text>
              {boostActive ? (
                <View style={s.boostBadge}>
                  <Text style={[s.boostText, { fontFamily: fonts.bodyBold }]}>
                    ×{v.boostMultiplier} {t("boostActiveLabel")}
                  </Text>
                </View>
              ) : null}
            </NeuCard>
          )
        ) : (
          <NeuCard style={{ padding: 16, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
              {t("notPartner")}
            </Text>
          </NeuCard>
        )}

        {offers.length > 0 ? (
          <NeuCard style={{ padding: 16, marginBottom: 16 }}>
            <View style={s.sectionTop}>
              <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
                {t("specialOffers", "Special offers").toUpperCase()}
              </Text>
              <Text style={[s.sourceText, { color: theme.textSecondary }]}>{importSourceLabel}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {offers.map((offer) => (
                <View key={offer} style={s.offerRow}>
                  <Text style={s.offerDot}>●</Text>
                  <Text style={[s.offerText, { fontFamily: fonts.bodyBold }]}>{offer}</Text>
                </View>
              ))}
            </View>
          </NeuCard>
        ) : null}

        {activeOffers.length > 0 ? (
          <NeuCard style={{ padding: 16, marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold, marginBottom: 10 }]}>
              {t("partnerOffers", "Partner offers").toUpperCase()}
            </Text>
            <View style={{ gap: 8 }}>
              {activeOffers.map((o) => (
                <View key={o.id} style={s.partnerOfferRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.partnerOfferTitle, { fontFamily: fonts.bodyBold }]}>{o.title}</Text>
                    {o.endsAt ? (
                      <Text style={s.partnerOfferMeta}>
                        до {new Date(o.endsAt).toLocaleDateString("ru-RU")}
                        {o.usageLimit ? ` · ${o.usageCount}/${o.usageLimit}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.partnerOfferPts}>
                    <Text style={[s.partnerOfferPtsVal, { fontFamily: fonts.displayHeavy }]}>+{o.pointsReward}</Text>
                    <Text style={s.partnerOfferPtsUnit}>pts</Text>
                  </View>
                </View>
              ))}
              <Text style={[s.partnerOfferHint, { color: theme.textSecondary }]}>
                Сканируйте QR-код в заведении чтобы получить баллы
              </Text>
            </View>
          </NeuCard>
        ) : null}

        {contacts.length > 0 ? (
          <NeuCard style={{ padding: 16, marginBottom: 16 }}>
            <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>
              {t("contacts", "Contacts").toUpperCase()}
            </Text>
            <View style={{ gap: 10 }}>
              {contacts.map((row) => (
                <Pressable
                  key={row.label}
                  disabled={!row.url}
                  onPress={() => row.url ? Linking.openURL(row.url) : undefined}
                  style={s.contactRow}
                >
                  <Text style={[s.contactLabel, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>{row.label}</Text>
                  <Text style={[s.contactValue, { color: theme.text, fontFamily: fonts.bodyBold }]} numberOfLines={1}>
                    {row.value}{row.url ? " ↗" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </NeuCard>
        ) : null}

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
        {rewards.length > 0 ? (
          <>
            <Text style={[s.heading, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
              {t("availableRewards", "Available rewards")}
            </Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {rewards.map((r, i) => {
                const rainbowGrad = REWARD_RAINBOW[i % REWARD_RAINBOW.length]!
                const normalGrad = REWARD_GRADS[i % REWARD_GRADS.length]!
                return isRainbow ? (
                  <VolumeGradient
                    key={r.id}
                    colors={[...rainbowGrad]}
                    shadowColor={rainbowGrad[0]}
                    shadowOpacity={0.3}
                    borderRadius={28}
                    style={s.rewardRow}
                    onPress={() => router.push({ pathname: "/reward/[id]", params: { id: r.id } })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rewardTitle, { fontFamily: fonts.bodyBold, color: "#FFFFFF" }]}>{r.title}</Text>
                      {r.description ? (
                        <Text style={[s.rewardDesc, { color: "rgba(255,255,255,0.65)" }]} numberOfLines={1}>{r.description}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.rewardCost, { fontFamily: fonts.displayHeavy, color: "#FFFFFF" }]}>{r.pointsCost}</Text>
                      <Text style={[s.rewardCostUnit, { color: "rgba(255,255,255,0.65)" }]}>pts</Text>
                    </View>
                  </VolumeGradient>
                ) : (
                  <NeuCard
                    key={r.id}
                    gradient={normalGrad}
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
                    {r.user.name ?? t("anonymous")}
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
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  name: { fontSize: 34, lineHeight: 38 },
  subtle: { fontSize: 13, marginTop: 4 },
  rating: { fontSize: 12, marginTop: 5 },

  rateCard: { padding: 20, alignItems: "center", marginBottom: 16, overflow: "hidden", borderRadius: 32 },
  heroBlob: { position: "absolute", top: -42, right: -42, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(167,232,238,0.28)" },
  rateLabel: { color: "#91A1B4", fontSize: 11, letterSpacing: 1.5 },
  rateValue: { color: colors.ink, fontSize: 56, lineHeight: 60, marginTop: 4 },
  rateUnit: { color: "#91A1B4", fontSize: 13 },
  boostBadge: { marginTop: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  boostText: { color: colors.ink, fontSize: 11 },

  sectionLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  sectionTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  sourceText: { fontSize: 10, flexShrink: 1, textAlign: "right" },
  body: { fontSize: 14, lineHeight: 20 },
  offerRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(236,255,235,0.62)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 9 },
  offerDot: { color: "#9FEED3", fontSize: 10 },
  offerText: { color: "#7FAFC2", fontSize: 12, flex: 1 },

  partnerOfferRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(139,61,255,0.06)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  partnerOfferTitle: { fontSize: 14, color: colors.ink },
  partnerOfferMeta: { fontSize: 11, color: "#91A1B4", marginTop: 2 },
  partnerOfferPts: { alignItems: "flex-end" },
  partnerOfferPtsVal: { fontSize: 18, color: "#8B3DFF", lineHeight: 20 },
  partnerOfferPtsUnit: { fontSize: 10, color: "#91A1B4" },
  partnerOfferHint: { fontSize: 11, textAlign: "center", marginTop: 4, opacity: 0.7 },
  contactRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(163,160,200,0.14)", paddingVertical: 8 },
  contactLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  contactValue: { fontSize: 13, flex: 1, textAlign: "right" },

  heading: { fontSize: 25, marginBottom: 12 },

  rewardRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 28 },
  rewardTitle: { color: colors.ink, fontSize: 16 },
  rewardDesc: { color: "#91A1B4", fontSize: 12, marginTop: 2 },
  rewardCost: { color: colors.ink, fontSize: 21, lineHeight: 23 },
  rewardCostUnit: { color: "#91A1B4", fontSize: 10 },

  reviewsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 },
  writeBtn: { fontSize: 12 },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reviewAuthor: { fontSize: 14, flex: 1, marginRight: 8 },
  reviewStars: { fontSize: 13, color: "#FF85D2" },
  reviewText: { fontSize: 13, lineHeight: 18 },
})
