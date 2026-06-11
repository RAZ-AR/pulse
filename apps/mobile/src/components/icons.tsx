import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg"

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
