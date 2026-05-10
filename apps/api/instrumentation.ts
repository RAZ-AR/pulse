// Next.js instrumentation runs before any request handlers.
// Use it to point PRISMA_QUERY_ENGINE_LIBRARY at the binary before Prisma initializes.
// This is necessary on Vercel because the Lambda mounts at /var/task/ while Prisma
// records the build-time path (/vercel/path0/packages/db/generated/).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { existsSync } = await import("fs")
  const { join } = await import("path")

  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return

  const binaryName = "libquery_engine-rhel-openssl-3.0.x.so.node"

  // Candidate paths ordered by likelihood on Vercel Lambda.
  const candidates = [
    // vercel/next built with outputFileTracingRoot = monorepo root
    join("/var/task/packages/db/generated", binaryName),
    // Next.js default server dir (copy via postbuild)
    join("/var/task/apps/api/.next/server", binaryName),
    // Direct from build env (sometimes accessible)
    join("/vercel/path0/packages/db/generated", binaryName),
    // Relative to this file (local dev or when traced)
    join(__dirname, "../../packages/db/generated", binaryName),
  ]

  for (const p of candidates) {
    if (existsSync(p)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = p
      console.log(`[prisma] engine found at ${p}`)
      return
    }
  }

  console.warn(`[prisma] engine binary not found in any candidate path`)
}
