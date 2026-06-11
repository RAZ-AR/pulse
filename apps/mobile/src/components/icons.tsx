import Svg, { Circle, Path } from "react-native-svg"

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
