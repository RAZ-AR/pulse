import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@pulse/trpc/server"
import type { TRPCContext } from "@pulse/trpc"
import { db } from "@pulse/db"
import { merchantAuth } from "@pulse/auth/merchant"

async function createContext(): Promise<TRPCContext> {
  const session = await merchantAuth()
  const merchantId = (session as { merchant?: { id: string } } | null)?.merchant?.id
  return { db, ...(merchantId !== undefined && { merchantId }) }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: ({ path, error }: { path: string | undefined; error: any }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on ${path}:`, error)
      }
    },
  })

export { handler as GET, handler as POST }
