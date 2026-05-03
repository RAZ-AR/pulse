import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
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
import { useTheme } from "../lib/theme"

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  const [bootDone, setBootDone] = useState(false)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() => createTRPCClient())
  const hydrate = useAuth((s) => s.hydrate)

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
