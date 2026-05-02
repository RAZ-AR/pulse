import { useColorScheme } from "react-native"

export type Theme = {
  bg: string
  surface: string
  text: string
  textSecondary: string
  border: string
}

export const colors = {
  pink: "#FF4D8F",
  sky: "#3DBEFF",
  mint: "#1FE3A0",
  light: {
    bg: "#FFFFFF",
    surface: "#F9FAFB",
    text: "#0F1115",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
  } satisfies Theme,
  dark: {
    bg: "#0F1115",
    surface: "#181B23",
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    border: "#1F2937",
  } satisfies Theme,
}

export function useTheme(): Theme {
  const scheme = useColorScheme()
  return scheme === "dark" ? colors.dark : colors.light
}
