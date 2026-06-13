import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg"

// ── Plus / Minus shaped console keys ──────────────────────────
// The button IS the shape: a green cross (+) and an orange bar (−),
// each with a darker extrusion below + a glossy top highlight.

// Soft "clay" console keys — just the cross / bar, puffy, with a gentle
// same-hue rounded bottom and a soft top gloss (no hard dark edge).
const T = 38            // arm thickness
const R = T / 2         // fully-rounded ends
const DROP = 5          // soft rounded "thickness" below the face

/** Mint plus-shaped key (earn). */
export function PlusKey({ size = 92 }: { size?: number }) {
  const VB = 96 + DROP
  return (
    <Svg width={size} height={size * (VB / 96)} viewBox={`0 0 96 ${VB}`}>
      <Defs>
        <LinearGradient id="plusFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B2E6D5" />
          <Stop offset="0.55" stopColor="#8FD3BC" />
          <Stop offset="1" stopColor="#74C2A8" />
        </LinearGradient>
      </Defs>
      {/* soft rounded underside (same hue, darker) */}
      <Rect x={6} y={29 + DROP} width={84} height={T} rx={R} fill="#5FAE92" />
      <Rect x={29} y={6 + DROP} width={T} height={84} rx={R} fill="#5FAE92" />
      {/* puffy face */}
      <Rect x={6} y={29} width={84} height={T} rx={R} fill="url(#plusFace)" />
      <Rect x={29} y={6} width={T} height={84} rx={R} fill="url(#plusFace)" />
      {/* soft top gloss */}
      <Ellipse cx={48} cy={20} rx={13} ry={7} fill="rgba(255,255,255,0.45)" />
    </Svg>
  )
}

/** Orange minus-shaped key (send). */
export function MinusKey({ size = 92 }: { size?: number }) {
  const VB = T + DROP + 2
  return (
    <Svg width={size} height={size * (VB / 96)} viewBox={`0 0 96 ${VB}`}>
      <Defs>
        <LinearGradient id="minusFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8C79B" />
          <Stop offset="0.55" stopColor="#F2A972" />
          <Stop offset="1" stopColor="#EC9A5A" />
        </LinearGradient>
      </Defs>
      <Rect x={6} y={1 + DROP} width={84} height={T} rx={R} fill="#D5894C" />
      <Rect x={6} y={1} width={84} height={T} rx={R} fill="url(#minusFace)" />
      <Ellipse cx={30} cy={13} rx={16} ry={6} fill="rgba(255,255,255,0.42)" />
    </Svg>
  )
}

/** Four-lobe clover with a white plus — the "earn" mark. */
export function IconClover({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={7.2} r={4.7} fill={color} />
      <Circle cx={16.8} cy={12} r={4.7} fill={color} />
      <Circle cx={12} cy={16.8} r={4.7} fill={color} />
      <Circle cx={7.2} cy={12} r={4.7} fill={color} />
      <Path fill="#FFFFFF" d="M12 9.2c.5 0 .9.4.9.9v1h1c.5 0 .9.4.9.9s-.4.9-.9.9h-1v1c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-1h-1c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h1v-1c0-.5.4-.9.9-.9Z" />
    </Svg>
  )
}

/** Paper-plane "send" arrow — the give-points mark. */
export function IconPlane({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M20.9 3.2c1-.4 2 .6 1.6 1.6l-6.4 16.7c-.4 1.1-2 1.1-2.4 0l-2.3-6.5-6.5-2.3c-1.1-.4-1.1-2 0-2.4L20.9 3.2Z" />
    </Svg>
  )
}

// ── Volumetric console buttons — the sign IS the button, like a ──
// ── Game Boy key: dark extrusion below + glossy gradient on top ──

const BTN_GRADIENT = (
  <Defs>
    <LinearGradient id="btn3d" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#EF7048" />
      <Stop offset="1" stopColor="#BC3617" />
    </LinearGradient>
  </Defs>
)
const SHADE = "#8E2810"

/** Big 3D clover key (earn). */
export function Clover3D({ size = 68 }: { size?: number }) {
  const lobes = (fill: string) => (
    <>
      <Circle cx={12} cy={6.9} r={4.7} fill={fill} />
      <Circle cx={17.1} cy={12} r={4.7} fill={fill} />
      <Circle cx={12} cy={17.1} r={4.7} fill={fill} />
      <Circle cx={6.9} cy={12} r={4.7} fill={fill} />
    </>
  )
  return (
    <Svg width={size} height={size} viewBox="0 0 24 25.8">
      {BTN_GRADIENT}
      <G y={1.8}>{lobes(SHADE)}</G>
      {lobes("url(#btn3d)")}
      <Ellipse cx={9.4} cy={4.9} rx={2.6} ry={1.3} fill="rgba(255,255,255,0.4)" />
      <Path fill="#FFFFFF" d="M12 9.2c.5 0 .9.4.9.9v1h1c.5 0 .9.4.9.9s-.4.9-.9.9h-1v1c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-1h-1c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h1v-1c0-.5.4-.9.9-.9Z" />
    </Svg>
  )
}

/** Big 3D paper-plane key (send). */
export function Plane3D({ size = 68 }: { size?: number }) {
  const PLANE = "M20.9 3.2c1-.4 2 .6 1.6 1.6l-6.4 16.7c-.4 1.1-2 1.1-2.4 0l-2.3-6.5-6.5-2.3c-1.1-.4-1.1-2 0-2.4L20.9 3.2Z"
  return (
    <Svg width={size} height={size} viewBox="0 0 24 25.8">
      {BTN_GRADIENT}
      <G y={1.8}><Path fill={SHADE} d={PLANE} /></G>
      <Path fill="url(#btn3d)" d={PLANE} />
      <Ellipse cx={16.4} cy={5.6} rx={2.8} ry={1.2} fill="rgba(255,255,255,0.38)" transform="rotate(-18 16.4 5.6)" />
    </Svg>
  )
}
