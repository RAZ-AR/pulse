import type { NextConfig } from "next"
import path from "path"

// Monorepo root — two levels above apps/api/
const repoRoot = path.join(__dirname, "../../")

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
    "@pulse/jobs",
  ],
  // Expand file tracing scope to the monorepo root so Next.js can trace
  // files in packages/db/generated (Prisma engine binary for Vercel Linux).
  outputFileTracingRoot: repoRoot,
  experimental: {
    outputFileTracingIncludes: {
      // Match all App Router routes; include the Prisma native engine binary.
      // Path is relative to outputFileTracingRoot (the monorepo root).
      "/api/**": ["packages/db/generated/**/*.node"],
    },
  },
}

export default config
