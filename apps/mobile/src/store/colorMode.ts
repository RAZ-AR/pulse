import { create } from "zustand"
import { Platform } from "react-native"

type ColorMode = "pastel" | "rainbow"

const KEY = "pulse_color_mode"

function loadMode(): ColorMode {
  if (Platform.OS === "web") {
    const v = globalThis.localStorage?.getItem(KEY)
    return v === "rainbow" ? "rainbow" : "pastel"
  }
  return "pastel"
}

function saveMode(mode: ColorMode) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(KEY, mode)
  }
}

type ColorModeState = {
  mode: ColorMode
  toggle: () => void
  setMode: (mode: ColorMode) => void
}

export const useColorMode = create<ColorModeState>((set, get) => ({
  mode: loadMode(),
  toggle() {
    const next: ColorMode = get().mode === "pastel" ? "rainbow" : "pastel"
    saveMode(next)
    set({ mode: next })
  },
  setMode(mode) {
    saveMode(mode)
    set({ mode })
  },
}))
