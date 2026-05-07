import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { trpc } from "../../src/lib/trpc"
import { colors, fonts, useTheme } from "../../src/lib/theme"
import { LavaLampSurface } from "../../src/components/neu"

type RewardItem = {
  id: string
  title: string
  pointsCost: number
  venue: { id: string; name: string }
}

function fmt(n: number) {
  return n.toLocaleString()
}

function daysLeft(d: Date | string | null | undefined): number {
  if (!d) return 0
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000))
}

function initials(name: string | null | undefined) {
  return (name ?? "P").slice(0, 1).toUpperCase()
}

export default function HomeScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation(["common", "venue"])

  const me = trpc.user.me.useQuery()
  const rewards = trpc.reward.list.useQuery({ limit: 8 })
  const nearby = trpc.venue.nearby.useQuery({
    lat: 44.7866,
    lng: 20.4489,
    radiusKm: 50,
    limit: 8,
  })
  const challenges = trpc.challenge.listMine.useQuery()

  const rewardItems = (rewards.data?.rewards ?? []) as RewardItem[]
  const activeChallenges = (challenges.data ?? []).filter((uc) => !uc.isCompleted)
  const total = me.data ? me.data.earnedPoints + me.data.welcomePoints : 0
  const welcomeDays = daysLeft(me.data?.welcomeExpiresAt ?? null)

  return (
    <ScrollView style={[s.scroll, { backgroundColor: theme.bg }]} contentContainerStyle={s.content}>
      <View style={s.topBar}>
        <CircleButton label="+" onPress={() => router.push("/earn")} />
        <View style={s.helloBlock}>
          <Text style={[s.kicker, { color: theme.textSecondary, fontFamily: fonts.bodyBold }]}>PULSE</Text>
          <Text style={[s.hello, { color: theme.text, fontFamily: fonts.displayHeavy }]}>
            {t("hiName", { name: me.data?.name?.split(" ")[0] ?? "Demo" })}
          </Text>
        </View>
        <CircleButton label="◦" onPress={() => router.push("/profile")} />
      </View>

      <LavaLampSurface style={[s.dashboard, theme.shadowRaised]}>
        <View style={s.dashboardGrid} />
        <View style={s.dashboardHead}>
          <View style={s.blackLogo}>
            <Text style={s.blackLogoText}>P</Text>
          </View>
          <View style={s.blackPill}>
            <Text style={[s.blackPillText, { fontFamily: fonts.bodyBold }]}>{t("dashboard")}</Text>
          </View>
        </View>

        <Text style={[s.dashboardTitle, { fontFamily: fonts.displayHeavy }]}>{t("loyaltyPlan")}</Text>
        <View style={s.balanceRow}>
          <Text style={[s.balance, { fontFamily: fonts.displayHeavy }]}>{fmt(total)}</Text>
          <Text style={[s.balanceUnit, { fontFamily: fonts.bodyBold }]}>{t("pointsUnit")}</Text>
        </View>

        <View style={s.coverageTrack}>
          <View style={[s.coverageFill, { width: `${Math.min(100, total / 50)}%` }]} />
          <View style={s.coverageCut} />
        </View>
        <View style={s.coverageLabels}>
          <Text style={s.coverageText}>{t("earnedShort", { count: me.data?.earnedPoints ?? 0 })}</Text>
          <Text style={s.coverageText}>{t("welcomeShort", { count: me.data?.welcomePoints ?? 0 })}</Text>
        </View>

        <View style={s.dragAction}>
          <View style={s.checkDot}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={[s.dragText, { fontFamily: fonts.bodyBold }]}>{t("scanVisitRedeem")}</Text>
          <Text style={s.dragChevron}>›››</Text>
        </View>
      </LavaLampSurface>

      <View style={s.metrics}>
        <MetricCard value={`${me.data?.currentStreak ?? 0}d`} label={t("streakLabel")} tone="cyan" />
        <MetricCard value={`${welcomeDays}d`} label={t("welcomeLeft")} tone="white" />
        <MetricCard value={`${activeChallenges.length}`} label={t("quests")} tone="black" />
      </View>

      <View style={s.actionRow}>
        <ActionPill label={t("scanReceipt")} icon="⌁" onPress={() => router.push("/scan")} dark />
        <ActionPill label={t("checkIn")} icon="⌖" onPress={() => router.push("/checkin")} />
      </View>

      <SectionHeader title={t("specialOffers")} action={t("allRewards")} onPress={() => router.push("/rewards")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.offerRail}>
        {rewardItems.slice(0, 6).map((reward, index) => (
          <OfferCard
            key={reward.id}
            title={reward.title}
            venue={reward.venue.name}
            points={reward.pointsCost}
            pointsLabel={t("pointsUnit")}
            openLabel={t("open")}
            featured={index === 0}
            onPress={() => router.push({ pathname: "/reward/[id]", params: { id: reward.id } })}
          />
        ))}
      </ScrollView>

      <SectionHeader title={t("venuesNearby")} action={t("nav.map")} onPress={() => router.push("/map")} />
      <View style={s.venueList}>
        {(nearby.data ?? []).slice(0, 5).map((venue) => {
          const offer = rewardItems.find((reward) => reward.venue.id === venue.id)
          return (
            <VenueCard
              key={venue.id}
              name={venue.name}
              category={t(`venue:category.${venue.category}`, venue.category.toLowerCase())}
              city={venue.city}
              address={venue.address}
              rate={venue.pointsPerCurrency ?? null}
              offer={offer?.title ?? t("partnerPoints")}
              logo={initials(venue.name)}
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
              receiptScanLabel={t("receiptScan")}
              menuLabel={t("menu")}
              routeLabel={t("route")}
            />
          )
        })}
      </View>
    </ScrollView>
  )
}

function CircleButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.circleButton}>
      <Text style={s.circleButtonText}>{label}</Text>
    </Pressable>
  )
}

function MetricCard({ value, label, tone }: { value: string; label: string; tone: "cyan" | "white" | "black" }) {
  const bg = tone === "cyan" ? colors.cyan : tone === "black" ? colors.lavaBase : "#FFFFFF"
  const fg = tone === "black" ? "#FFFFFF" : colors.ink
  const content = (
    <>
      <Text style={[s.metricValue, { color: fg, fontFamily: fonts.displayHeavy }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: tone === "black" ? "rgba(255,255,255,0.82)" : "#7A808E", fontFamily: fonts.bodyBold }]}>
        {label.toUpperCase()}
      </Text>
    </>
  )

  if (tone === "black") {
    return (
      <LavaLampSurface style={s.metricCard} contentStyle={s.metricCardContent}>
        {content}
      </LavaLampSurface>
    )
  }

  return (
    <View style={[s.metricCard, { backgroundColor: bg }]}>{content}</View>
  )
}

function ActionPill({ label, icon, onPress, dark }: { label: string; icon: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.actionPill, dark ? s.actionPillDark : s.actionPillLight]}>
      {dark ? <LavaLampSurface style={StyleSheet.absoluteFill} /> : null}
      <View style={[s.actionIcon, dark ? s.actionIconDark : s.actionIconLight]}>
        <Text style={[s.actionIconText, { color: dark ? colors.lavaPink : "#FFFFFF" }]}>{icon}</Text>
      </View>
      <Text style={[s.actionLabel, { color: dark ? "#FFFFFF" : colors.ink, fontFamily: fonts.bodyBold }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { fontFamily: fonts.displayHeavy }]}>{title}</Text>
      <Pressable onPress={onPress} style={s.sectionButton}>
        <Text style={[s.sectionButtonText, { fontFamily: fonts.bodyBold }]}>{action}</Text>
      </Pressable>
    </View>
  )
}

function OfferCard({
  title,
  venue,
  points,
  pointsLabel,
  openLabel,
  featured,
  onPress,
}: {
  title: string
  venue: string
  points: number
  pointsLabel: string
  openLabel: string
  featured: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={s.offerPressable}>
      {featured ? (
        <View style={[s.offerCard, s.offerCardFeatured]}>
          <OfferCardContent
            title={title}
            venue={venue}
            points={points}
            pointsLabel={pointsLabel}
            openLabel={openLabel}
            featured={featured}
          />
        </View>
      ) : (
        <LavaLampSurface style={s.offerCard}>
          <OfferCardContent
            title={title}
            venue={venue}
            points={points}
            pointsLabel={pointsLabel}
            openLabel={openLabel}
            featured={featured}
          />
        </LavaLampSurface>
      )}
    </Pressable>
  )
}

function OfferCardContent({
  title,
  venue,
  points,
  pointsLabel,
  openLabel,
  featured,
}: {
  title: string
  venue: string
  points: number
  pointsLabel: string
  openLabel: string
  featured: boolean
}) {
  return (
    <>
      <View style={s.offerTop}>
        <View style={[s.offerLogo, featured ? s.offerLogoDark : s.offerLogoLight]}>
          <Text style={[s.offerLogoText, { color: featured ? "#FFFFFF" : colors.ink }]}>✦</Text>
        </View>
        <Text style={[s.offerPoints, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>
          {points} {pointsLabel}
        </Text>
      </View>
      <Text style={[s.offerTitle, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.displayHeavy }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[s.offerVenue, { color: featured ? "#5A606C" : "rgba(255,255,255,0.62)", fontFamily: fonts.bodyBold }]} numberOfLines={1}>
        {venue}
      </Text>
      <View style={[s.offerLink, featured ? s.offerLinkLight : s.offerLinkDark]}>
        <Text style={[s.offerLinkText, { color: featured ? colors.ink : "#FFFFFF", fontFamily: fonts.bodyBold }]}>{openLabel} ↗</Text>
      </View>
    </>
  )
}

function VenueCard({
  name,
  category,
  city,
  address,
  rate,
  offer,
  logo,
  onPress,
  receiptScanLabel,
  menuLabel,
  routeLabel,
}: {
  name: string
  category: string
  city: string
  address: string
  rate: number | null
  offer: string
  logo: string
  onPress: () => void
  receiptScanLabel: string
  menuLabel: string
  routeLabel: string
}) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} style={[s.venueCard, theme.shadowRaisedSm]}>
      <View style={s.venueLogo}>
        <Text style={[s.venueLogoText, { fontFamily: fonts.displayHeavy }]}>{logo}</Text>
      </View>
      <View style={s.venueMain}>
        <View style={s.venueTitleRow}>
          <Text style={[s.venueName, { fontFamily: fonts.displayHeavy }]} numberOfLines={1}>{name}</Text>
          <Text style={s.venueArrow}>↗</Text>
        </View>
        <Text style={[s.venueMeta, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>
          {category} · {city}
        </Text>
        <Text style={s.venueAddress} numberOfLines={1}>{address}</Text>
        <View style={s.venueChips}>
          <View style={s.venueChipDark}>
            <Text style={[s.venueChipDarkText, { fontFamily: fonts.bodyBold }]}>
              {rate ? `${rate.toFixed(3)} pts/RSD` : receiptScanLabel}
            </Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{menuLabel}</Text>
          </View>
          <View style={s.venueChipLight}>
            <Text style={[s.venueChipLightText, { fontFamily: fonts.bodyBold }]}>{routeLabel}</Text>
          </View>
        </View>
        <View style={s.specialLine}>
          <Text style={s.specialDot}>●</Text>
          <Text style={[s.specialText, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{offer}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  helloBlock: { flex: 1 },
  kicker: { fontSize: 11, letterSpacing: 1.8 },
  hello: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(5,6,10,0.06)",
  },
  circleButtonText: { color: colors.ink, fontSize: 25, lineHeight: 27 },

  dashboard: { borderRadius: 32, padding: 16, marginBottom: 12, overflow: "hidden" },
  dashboardGrid: {
    position: "absolute",
    top: -70,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "rgba(167,232,238,0.28)",
  },
  dashboardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  blackLogo: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lavaPink, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  blackLogoText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  blackPill: { backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9 },
  blackPillText: { color: "#FFFFFF", fontSize: 13 },
  dashboardTitle: { color: "#FFFFFF", fontSize: 28, lineHeight: 30, width: 220, letterSpacing: 0 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  balance: { color: "#FFFFFF", fontSize: 64, lineHeight: 66, letterSpacing: 0 },
  balanceUnit: { color: "rgba(255,255,255,0.62)", fontSize: 15, marginBottom: 9 },
  coverageTrack: { height: 28, borderRadius: 14, backgroundColor: "#303440", overflow: "hidden", marginTop: 10 },
  coverageFill: { height: "100%", backgroundColor: "#EAF0FA" },
  coverageCut: { position: "absolute", right: 0, top: 0, bottom: 0, width: 62, backgroundColor: "rgba(255,255,255,0.08)" },
  coverageLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  coverageText: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" },
  dragAction: { marginTop: 13, backgroundColor: "#FFFFFF", borderRadius: 99, padding: 7, flexDirection: "row", alignItems: "center", gap: 10 },
  checkDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lavaPink, alignItems: "center", justifyContent: "center" },
  checkText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  dragText: { color: colors.ink, fontSize: 14, flex: 1 },
  dragChevron: { color: "#A7ADBA", fontSize: 19, marginRight: 8 },

  metrics: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, borderRadius: 24, padding: 13, minHeight: 82, justifyContent: "center" },
  metricCardContent: { flex: 1, justifyContent: "center" },
  metricValue: { fontSize: 26, lineHeight: 28, letterSpacing: 0 },
  metricLabel: { fontSize: 9, marginTop: 5, letterSpacing: 0.8 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  actionPill: { flex: 1, borderRadius: 99, padding: 7, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" },
  actionPillDark: { backgroundColor: colors.lavaBase },
  actionPillLight: { backgroundColor: "#FFFFFF" },
  actionIcon: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  actionIconDark: { backgroundColor: "#FFFFFF" },
  actionIconLight: { backgroundColor: colors.lavaPink },
  actionIconText: { fontSize: 16, fontWeight: "900" },
  actionLabel: { fontSize: 13 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 25, letterSpacing: 0 },
  sectionButton: { backgroundColor: "#FFFFFF", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8 },
  sectionButtonText: { color: colors.ink, fontSize: 11 },
  offerRail: { gap: 12, paddingBottom: 20 },
  offerPressable: { width: 176 },
  offerCard: { minHeight: 174, borderRadius: 30, padding: 14, overflow: "hidden" },
  offerCardFeatured: { backgroundColor: colors.cyan },
  offerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  offerLogo: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  offerLogoDark: { backgroundColor: colors.lavaPink },
  offerLogoLight: { backgroundColor: "#FFFFFF" },
  offerLogoText: { fontSize: 17, fontWeight: "900" },
  offerPoints: { backgroundColor: "rgba(255,255,255,0.28)", color: "#FFFFFF", borderRadius: 99, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  offerTitle: { fontSize: 21, lineHeight: 23, letterSpacing: 0, minHeight: 48 },
  offerVenue: { fontSize: 12, marginTop: 8 },
  offerLink: { marginTop: "auto", alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  offerLinkLight: { backgroundColor: "rgba(255,255,255,0.72)" },
  offerLinkDark: { backgroundColor: "rgba(255,255,255,0.14)" },
  offerLinkText: { fontSize: 12 },

  venueList: { gap: 12 },
  venueCard: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 12, flexDirection: "row", gap: 12 },
  venueLogo: { width: 58, height: 58, borderRadius: 22, backgroundColor: "#EAF0FA", alignItems: "center", justifyContent: "center" },
  venueLogoText: { color: colors.ink, fontSize: 22 },
  venueMain: { flex: 1 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  venueName: { color: colors.ink, fontSize: 20, lineHeight: 24, flex: 1, marginRight: 8, letterSpacing: 0 },
  venueArrow: { color: colors.ink, fontSize: 22 },
  venueMeta: { color: "#6B7280", fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  venueAddress: { color: "#8E95A3", fontSize: 12, marginTop: 2 },
  venueChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  venueChipDark: { backgroundColor: colors.lavaBase, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipDarkText: { color: "#FFFFFF", fontSize: 10 },
  venueChipLight: { backgroundColor: "#EEF3FB", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  venueChipLightText: { color: colors.ink, fontSize: 10 },
  specialLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "#F3F7FF", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  specialDot: { color: colors.skySolid, fontSize: 10 },
  specialText: { color: colors.ink, fontSize: 12, flex: 1 },
})
