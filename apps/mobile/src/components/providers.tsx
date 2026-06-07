import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk"
import { trpc, createTRPCClient } from "../lib/trpc"
import { initI18n } from "../lib/i18n"
import { useAuth } from "../store/auth"
import { fonts, useTheme } from "../lib/theme"

const DefaultText = Text as typeof Text & {
  defaultProps?: { allowFontScaling?: boolean; style?: unknown }
}

DefaultText.defaultProps = DefaultText.defaultProps ?? {}
DefaultText.defaultProps.allowFontScaling = false
DefaultText.defaultProps.style = [
  { fontFamily: fonts.body, letterSpacing: 0 },
  DefaultText.defaultProps.style,
]

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  const [bootDone, setBootDone] = useState(false)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() => createTRPCClient())
  const hydrate = useAuth((s) => s.hydrate)

  useEffect(() => {
    if (typeof document === "undefined") return
    if (document.getElementById("ayoo-poster-fonts")) return
    const style = document.createElement("style")
    style.id = "ayoo-poster-fonts"
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Climate+Crisis&display=swap');

      html, body, #root {
        font-family: "Helvetica Neue", Arial, SpaceGrotesk_600SemiBold, sans-serif;
        letter-spacing: 0;
      }
      div, span, button, input, textarea {
        letter-spacing: 0;
      }
      [style*="-apple-system"], [style*="system-ui"],
      div[dir="auto"]:not([style]), span[dir="auto"]:not([style]) {
        font-family: "Helvetica Neue", Arial, SpaceGrotesk_600SemiBold, sans-serif !important;
      }
    `
    document.head.appendChild(style)
  }, [])

  // Map 800ExtraBold to 700Bold — extra-bold isn't in the @expo-google-fonts package,
  // and 800 is rendered as 700 by RN anyway.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceGrotesk_800ExtraBold: SpaceGrotesk_700Bold,
  })

  useEffect(() => {
    Promise.all([initI18n(), hydrate()]).then(() => setBootDone(true))
  }, [hydrate])

  if (!bootDone || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.text} />
      </View>
    )
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
