/**
 * pts-01 — один растр, три рендера.
 *
 *   Matrix shape="square"  — иконки и коллекция
 *   Matrix shape="dot"     — рабочий дисплей
 *   SignalMatrix           — сигнальный экран, точки переменного диаметра
 *
 * Рисуем через react-native-svg: одна нода вместо сотен View,
 * поэтому поле 24×30 не роняет список.
 */
import Svg, { Circle, Rect } from "react-native-svg"
import { amplitudeRatio, ICONS, type Amplitude, type IconName } from "../lib/raster"

type Shape = "square" | "dot"

type MatrixProps = {
  rows: readonly string[]
  cell: number
  gap?: number
  on: string
  off?: string | undefined
  shape?: Shape
}

/** Ширина поля в пикселях — чтобы экран мог посчитать раскладку заранее. */
export function matrixWidth(cols: number, cell: number, gap: number): number {
  return cols * cell + (cols - 1) * gap
}

/** Размер клетки, при котором поле ровно вписывается в доступную ширину. */
export function cellFor(width: number, cols: number, gap: number): number {
  return (width - (cols - 1) * gap) / cols
}

export function Matrix({ rows, cell, gap = 0, on, off, shape = "square" }: MatrixProps) {
  const cols = rows[0]?.length ?? 0
  const step = cell + gap
  const w = matrixWidth(cols, cell, gap)
  const h = matrixWidth(rows.length, cell, gap)
  const r = cell / 2

  const nodes: React.ReactNode[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) {
      const filled = row[x] === "#"
      const color = filled ? on : off
      if (!color) continue
      const key = `${y}-${x}`
      if (shape === "dot") {
        nodes.push(<Circle key={key} cx={x * step + r} cy={y * step + r} r={r} fill={color} />)
      } else {
        nodes.push(<Rect key={key} x={x * step} y={y * step} width={cell} height={cell} fill={color} />)
      }
    }
  })

  return <Svg width={w} height={h}>{nodes}</Svg>
}

type SignalMatrixProps = {
  field: Amplitude[][]
  cell: number
  gap?: number
  color: string
}

export function SignalMatrix({ field, cell, gap = 0, color }: SignalMatrixProps) {
  const cols = field[0]?.length ?? 0
  const step = cell + gap
  const half = cell / 2

  const nodes: React.ReactNode[] = []
  field.forEach((row, y) => {
    row.forEach((level, x) => {
      const ratio = amplitudeRatio(level)
      if (ratio === 0) return
      nodes.push(
        <Circle
          key={`${y}-${x}`}
          cx={x * step + half}
          cy={y * step + half}
          r={(cell * ratio) / 2}
          fill={color}
        />,
      )
    })
  })

  return (
    <Svg width={matrixWidth(cols, cell, gap)} height={matrixWidth(field.length, cell, gap)}>
      {nodes}
    </Svg>
  )
}

/** Пиксельная иконка 9×9. size — сторона всей иконки. */
export function PixIcon({ name, size, color }: { name: IconName; size: number; color: string }) {
  return <Matrix rows={ICONS[name]} cell={size / 9} on={color} shape="square" />
}
