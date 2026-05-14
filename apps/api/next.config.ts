import type { NextConfig } from "next"
import path from "path"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/bot",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
    "@pulse/jobs",
  ],
  // Expand tracing to the monorepo root so Prisma engine binary in
  // packages/db/generated is included in the Vercel Lambda bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    // Glob relative to outputFileTracingRoot (monorepo root).
    "/api/**": ["packages/db/generated/**/*.node"],
  },
}

export default config
