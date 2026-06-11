import { create } from "zustand"

// Rainbow mode removed — the app is always in the light "pastel" design.
// The store shape is kept so existing `useColorMode` consumers compile;
// every `mode === "rainbow"` branch is now dead.
type ColorMode = "pastel" | "rainbow"

type ColorModeState = {
  mode: ColorMode
  toggle: () => void
  setMode: (mode: ColorMode) => void
}

export const useColorMode = create<ColorModeState>(() => ({
  mode: "pastel",
  toggle() {},
  setMode() {},
}))
