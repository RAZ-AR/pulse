import { existsSync } from "fs"
import { join } from "path"

const binaryName = "libquery_engine-rhel-openssl-3.0.x.so.node"

export async function GET() {
  const candidates = [
    join("/var/task/packages/db/generated", binaryName),
    join("/var/task/apps/api/.next/server", binaryName),
    join("/vercel/path0/packages/db/generated", binaryName),
    join(__dirname, "../../packages/db/generated", binaryName),
    join(__dirname, binaryName),
  ]

  const found = candidates.filter(existsSync)

  return Response.json({
    status: "ok",
    service: "pulse-api",
    ts: Date.now(),
    __dirname,
    PRISMA_QUERY_ENGINE_LIBRARY: process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? null,
    NODE_ENV: process.env.NODE_ENV,
    prismaEngineSearch: { candidates, found },
  })
}
