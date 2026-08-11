import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PixIcon } from "./Matrix"
import { fonts, pts, radius } from "../lib/theme"
import type { IconName } from "../lib/raster"

const TABS: readonly { key: string; labelKey: string; href: string; icon: IconName }[] = [
  { key: "index", labelKey: "nav.home", href: "/", icon: "coin" },
  { key: "earn", labelKey: "nav.earn", href: "/earn", icon: "scan" },
  { key: "rewards", labelKey: "nav.rewards", href: "/rewards", icon: "gift" },
  { key: "map", labelKey: "nav.map", href: "/map", icon: "nav" },
  { key: "profile", labelKey: "nav.profile", href: "/profile", icon: "me" },
]

function activeIndex(pathname: string) {
  if (pathname.startsWith("/earn") || pathname.startsWith("/scan") || pathname.startsWith("/checkin")) return 1
  if (pathname.startsWith("/rewards") || pathname.startsWith("/reward")) return 2
  if (pathname.startsWith("/map") || pathname.startsWith("/venue")) return 3
  if (
    pathname.startsWith("/profile") || pathname.startsWith("/badges") ||
    pathname.startsWith("/referrals") || pathname.startsWith("/friends") || pathname.startsWith("/gift")
  ) return 4
  return 0
}

export function AppDock() {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation("common")
  const insets = useSafeAreaInsets()
  const index = activeIndex(pathname)
  const bottom = Platform.OS === "web" ? 0 : Math.max(insets.bottom, 8)

  const wrapper = Platform.OS === "web"
    ? [s.wrap, { paddingBottom: bottom, position: "fixed" as "absolute", zIndex: 1000 }]
    : [s.wrap, { paddingBottom: bottom }]

  return (
    <View style={wrapper}>
      <View style={s.rule} />
      <View style={s.row}>
        {TABS.map((tab, i) => {
          const focused = i === index
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href as never)}
              style={({ pressed }) => [s.slot, focused && s.slotActive, pressed && s.pressed]}
            >
              <PixIcon name={tab.icon} size={18} color={focused ? pts.white : pts.mid} />
              <Text style={[s.label, focused && s.labelActive]} numberOfLines={1}>
                {t(tab.labelKey).toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: pts.paper,
  },
  rule: { height: 1, backgroundColor: pts.ink },
  row: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, gap: 4 },
  slot: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  slotActive: { backgroundColor: pts.ink },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.mono, fontSize: 7.5, letterSpacing: 0.9, color: pts.mid },
  labelActive: { color: pts.white },
})
