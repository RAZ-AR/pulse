"use client"

import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "@pulse/trpc/server"

export const trpc = createTRPCReact<AppRouter>()

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  })
}
