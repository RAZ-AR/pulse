import { useEffect, useRef, useState } from "react"
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { Tabs } from "expo-router"
import { useRouter } from "expo-router"
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import Svg, { Circle, Ellipse, Path } from "react-native-svg"
import { fonts, useTheme } from "../../src/lib/theme"

// ── Layout geometry ────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width
const H_MARGIN = 20
const DOCK_W   = SCREEN_W - H_MARGIN * 2
const DOCK_H   = 60
const FAB_D    = 60            // detached "earn" circle
const GAP      = 10
const PILL_W   = DOCK_W - FAB_D - GAP
const TAB_N    = 3
const SLOT_W   = PILL_W / TAB_N
const IND_W    = Math.min(96, SLOT_W - 10)
const IND_H    = 44
const IND_TOP  = (DOCK_H - IND_H) / 2

const ORANGE = "#fd4600"
const DARK = "#55534D"   // inactive dock icons — dark grey

// ── Chunky filled "puffy" icon set ────────────────────────────
function IconHome({ color }: { color: string }) {
  // Playful "eyes" — two tilted beans with highlight holes (reference style)
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Ellipse cx={8.3} cy={12} rx={4.4} ry={5.8} fill={color} transform="rotate(-14 8.3 12)" />
      <Ellipse cx={15.7} cy={12} rx={4.4} ry={5.8} fill={color} transform="rotate(14 15.7 12)" />
      <Ellipse cx={7.3} cy={9.9} rx={1.7} ry={2.1} fill="#FFFFFF" transform="rotate(-14 7.3 9.9)" />
      <Ellipse cx={14.8} cy={9.9} rx={1.7} ry={2.1} fill="#FFFFFF" transform="rotate(14 14.8 9.9)" />
    </Svg>
  )
}
function IconEarn({ color }: { color: string }) {
  // Clover of four lobes with a white plus — the detached circle in the reference
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Circle cx={12} cy={7.2} r={4.7} fill={color} />
      <Circle cx={16.8} cy={12} r={4.7} fill={color} />
      <Circle cx={12} cy={16.8} r={4.7} fill={color} />
      <Circle cx={7.2} cy={12} r={4.7} fill={color} />
      <Path fill="#FFFFFF" d="M12 9.2c.5 0 .9.4.9.9v1h1c.5 0 .9.4.9.9s-.4.9-.9.9h-1v1c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-1h-1c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h1v-1c0-.5.4-.9.9-.9Z" />
    </Svg>
  )
}
function IconRewards({ color }: { color: string }) {
  // Filled heart
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} d="M12 20.7C9.2 18.6 3.9 14.8 2.8 10.9 1.9 7.7 4 4.9 6.9 4.6c1.9-.2 3.9.9 5.1 2.7 1.2-1.8 3.2-2.9 5.1-2.7 2.9.3 5 3.1 4.1 6.3-1.1 3.9-6.4 7.7-9.2 9.8Z" />
    </Svg>
  )
}
function IconMap({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path fill={color} fillRule="evenodd" clipRule="evenodd" d="M12 2a7.2 7.2 0 0 1 7.2 7.2c0 4.9-5.4 10.45-6.65 11.7a.78.78 0 0 1-1.1 0C10.2 19.65 4.8 14.1 4.8 9.2A7.2 7.2 0 0 1 12 2Zm0 4.5a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z" />
    </Svg>
  )
}
function IconReceipt({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill={color} fillRule="evenodd" clipRule="evenodd" d="M6.2 2.6h11.6c.9 0 1.6.7 1.6 1.6v15.9l-2.6-1.7-2.4 1.7-2.4-1.7-2.4 1.7-2.4-1.7-2.6 1.7V4.2c0-.9.7-1.6 1.6-1.6Zm2 4.6a1 1 0 0 0 0 2h7.6a1 1 0 1 0 0-2H8.2Zm0 4a1 1 0 0 0 0 2h5a1 1 0 1 0 0-2h-5Z" />
    </Svg>
  )
}
function IconCheckin({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill={color} fillRule="evenodd" clipRule="evenodd" d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm4.5 6.6-5.2 5.6a1.2 1.2 0 0 1-1.76.02L7.4 12.4a1.2 1.2 0 1 1 1.7-1.7l1.3 1.3 4.34-4.66a1.2 1.2 0 0 1 1.76 1.66Z" />
    </Svg>
  )
}
function IconGift({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill={color} d="M8.6 2.7c1.5-.5 2.9.6 3.4 2.1.5-1.5 1.9-2.6 3.4-2.1 1.7.5 2 2.7.6 4.3h-8c-1.4-1.6-1.1-3.8.6-4.3ZM4.5 8.4h15a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1h-6.2V8.4h-2.6v3.8H4.5a1 1 0 0 1-1-1V9.4a1 1 0 0 1 1-1Zm1.4 5.4h4.8v7.6H7.3a1.4 1.4 0 0 1-1.4-1.4v-6.2Zm7.4 0h4.8v6.2a1.4 1.4 0 0 1-1.4 1.4h-3.4v-7.6Z" />
    </Svg>
  )
}

// ── Dock contents ─────────────────────────────────────────────
const DOCK_TABS = [
  { name: "index",   label: "HOME",    Icon: IconHome },
  { name: "rewards", label: "REWARDS", Icon: IconRewards },
  { name: "map",     label: "MAP",     Icon: IconMap },
] as const

// All tab routes (order = navigator order; earn/profile have no dock slot)
const ROUTES = ["index", "earn", "rewards", "map", "profile"] as const

// ── Liquid Dock: glass pill (3 tabs) + detached "earn" circle ──
function LiquidDock({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation("common")
  const bottom = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 8)

  const activeName = state.routes[state.index]?.name
  const dockIndex = DOCK_TABS.findIndex((d) => d.name === activeName)

  const indX  = useRef(new Animated.Value(Math.max(dockIndex, 0) * SLOT_W + (SLOT_W - IND_W) / 2)).current
  const indOp = useRef(new Animated.Value(dockIndex >= 0 ? 1 : 0)).current
  const menuAnim = useRef(new Animated.Value(0)).current
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (dockIndex >= 0) {
      Animated.spring(indX, {
        toValue: dockIndex * SLOT_W + (SLOT_W - IND_W) / 2,
        useNativeDriver: Platform.OS !== "web",
        tension: 180,
        friction: 15,
      }).start()
    }
    Animated.timing(indOp, {
      toValue: dockIndex >= 0 ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start()
  }, [dockIndex, indX, indOp])

  useEffect(() => {
    Animated.spring(menuAnim, {
      toValue: menuOpen ? 1 : 0,
      useNativeDriver: Platform.OS !== "web",
      tension: 160,
      friction: 14,
    }).start()
  }, [menuOpen, menuAnim])

  const EARN_ACTIONS = [
    { key: "partners", label: t("partnerOffers"), Icon: IconGift,    go: () => navigation.navigate("earn") },
    { key: "checkin",  label: t("checkIn"),       Icon: IconCheckin, go: () => router.push("/checkin") },
    { key: "scan",     label: t("scanReceipt"),   Icon: IconReceipt, go: () => router.push("/scan") },
  ]

  const wrapperStyle = Platform.OS === "web"
    ? [s.wrapper, { bottom, position: "fixed" as "absolute", zIndex: 1000 }]
    : [s.wrapper, { bottom }]

  return (
    <View pointerEvents="box-none" style={wrapperStyle}>
      {/* tap-outside catcher while the earn menu is open */}
      {menuOpen && <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)} />}

      {/* ── Earn submenu — circles popping up above the FAB ── */}
      <View pointerEvents={menuOpen ? "auto" : "none"} style={s.menuWrap}>
        {EARN_ACTIONS.map((a, i) => (
          <Animated.View
            key={a.key}
            style={[
              s.menuItem,
              {
                opacity: menuAnim,
                transform: [
                  { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [16 * (EARN_ACTIONS.length - i), 0] }) },
                  { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          >
            <View style={s.menuLabel}>
              <Text style={[s.menuLabelText, { fontFamily: fonts.bodyBold }]} numberOfLines={1}>{a.label}</Text>
            </View>
            <Pressable
              onPress={() => { setMenuOpen(false); a.go() }}
              style={({ pressed }) => [s.menuCircle, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <a.Icon color={ORANGE} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <View style={s.row} pointerEvents="box-none">
        {/* ── Glass pill with 3 tabs ── */}
        <View style={[s.dockShell, s.shellGlass]}>
          <Animated.View
            pointerEvents="none"
            style={[s.indicator, { opacity: indOp, transform: [{ translateX: indX }] }]}
          >
            <View style={s.indicatorHighlight} />
          </Animated.View>

          {DOCK_TABS.map((tab) => {
            const route = state.routes.find((r) => r.name === tab.name)
            if (!route) return null
            const isFocused = activeName === tab.name
            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  setMenuOpen(false)
                  const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
                  if (!isFocused && !ev.defaultPrevented) navigation.navigate(route.name)
                }}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                style={s.slot}
              >
                <tab.Icon color={isFocused ? ORANGE : DARK} />
                {isFocused ? (
                  <Text style={[s.label, { fontFamily: fonts.pixel }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>

        {/* ── Detached "earn" circle ── */}
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          style={({ pressed }) => [
            s.fab,
            s.shellGlass,
            (menuOpen || activeName === "earn") && s.fabActive,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <IconEarn color={(menuOpen || activeName === "earn") ? ORANGE : DARK} />
        </Pressable>
      </View>
    </View>
  )
}

// ── Stable dock renderer (module-level = always same reference) ──
function renderDock(props: BottomTabBarProps) {
  return <LiquidDock {...props} />
}

// ── Themed root — provides correct bg on mode switch ──────────
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {children}
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <ThemedRoot>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        } as object}
        tabBar={renderDock}
      >
        {ROUTES.map((name) => (
          <Tabs.Screen key={name} name={name} />
        ))}
      </Tabs>
    </ThemedRoot>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: H_MARGIN,
    right: H_MARGIN,
    height: DOCK_H,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    height: DOCK_H,
  },

  backdrop: {
    position: "absolute",
    top: -1400,
    bottom: -60,
    left: -H_MARGIN * 2,
    right: -H_MARGIN * 2,
  },

  // ── Dock shell / glass surface ────
  dockShell: {
    width: PILL_W,
    flexDirection: "row",
    height: DOCK_H,
    borderRadius: DOCK_H / 2,
    alignItems: "center",
  },

  shellGlass: {
    // Volumetric clay pill — light top, extruded bottom edge, soft shadow
    backgroundColor: "#efeeea",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 5,
    borderTopColor:    "rgba(255,255,255,0.95)",
    borderLeftColor:   "rgba(255,255,255,0.7)",
    borderRightColor:  "rgba(120,112,96,0.12)",
    borderBottomColor: "rgba(110,102,86,0.22)",
    shadowColor:    "#9A958A",
    shadowOffset:   { width: 0, height: 12 },
    shadowOpacity:  0.4,
    shadowRadius:   24,
    elevation:      12,
  },

  // ── Raised clay indicator ─────
  indicator: {
    position: "absolute",
    top:    IND_TOP - 2,
    left:   0,
    width:  IND_W,
    height: IND_H,
    borderRadius: IND_H / 2,
    backgroundColor: "#F6F5F2",
    borderTopWidth: 1.5,
    borderBottomWidth: 3,
    borderTopColor:    "rgba(255,255,255,1)",
    borderBottomColor: "rgba(110,102,86,0.16)",
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: "hidden",
  },
  indicatorHighlight: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
    backgroundColor: "rgba(255,255,255,1.0)",
    borderRadius: 1,
  },

  // ── Tab slot ──────
  slot: {
    flex:           1,
    height:         DOCK_H,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap: 5,
  },

  label: {
    fontSize:      8,
    letterSpacing: 0,
    color: ORANGE,
  },

  // ── Earn FAB ──────
  fab: {
    width: FAB_D,
    height: FAB_D,
    borderRadius: FAB_D / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  fabActive: {
    backgroundColor: "#FBEADC",
    borderBottomColor: "rgba(180,120,70,0.30)",
  },

  // ── Earn submenu ──────
  menuWrap: {
    position: "absolute",
    right: 0,
    bottom: DOCK_H + 12,
    alignItems: "flex-end",
    gap: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuLabel: {
    backgroundColor: "rgba(252,253,255,0.92)",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#B7B0A0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
    maxWidth: 220,
  },
  menuLabelText: { fontSize: 12, color: ORANGE },
  menuCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#efeeea",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 4,
    borderTopColor:    "rgba(255,255,255,0.95)",
    borderLeftColor:   "rgba(255,255,255,0.7)",
    borderRightColor:  "rgba(120,112,96,0.12)",
    borderBottomColor: "rgba(110,102,86,0.22)",
    shadowColor: "#9A958A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
})
