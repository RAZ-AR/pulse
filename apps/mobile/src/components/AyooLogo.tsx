import { SvgXml } from "react-native-svg"

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 171.15 100">
  <ellipse cx="163.42" cy="50" rx="7.73" ry="50" fill="#0F1115"/>
  <circle cx="50" cy="50" r="50" fill="#0F1115"/>
  <ellipse cx="127.84" cy="50" rx="27.84" ry="50" fill="#0F1115"/>
  <text fill="#fff" font-size="28" font-weight="800" transform="translate(4.66 59.71)">
    <tspan letter-spacing="-1.12" x="0" y="0">a</tspan>
    <tspan letter-spacing="-1.12" x="20.44" y="0">y</tspan>
    <tspan x="42.31" y="0">oo</tspan>
  </text>
</svg>`

export function AyooLogo({ width = 86, height = 50 }: { width?: number; height?: number }) {
  return <SvgXml xml={SVG} width={width} height={height} />
}
