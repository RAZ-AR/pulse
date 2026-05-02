import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { trpc, createTRPCClient } from "../lib/trpc"
import { initI18n } from "../lib/i18n"
import { useAuth } from "../store/auth"
import { colors } from "../lib/theme"

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() => createTRPCClient())
  const hydrate = useAuth((s) => s.hydrate)

  useEffect(() => {
    Promise.all([initI18n(), hydrate()]).then(() => setReady(true))
  }, [hydrate])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.light.bg }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
