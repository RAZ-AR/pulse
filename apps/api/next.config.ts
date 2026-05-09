import type { NextConfig } from "next"
import path from "path"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
    "@pulse/jobs",
  ],
  // Required for Prisma in Vercel monorepo deployments:
  // outputFileTracingRoot expands the file-tracing scope to the monorepo root,
  // so the Prisma engine binary in packages/db/generated is included in the Lambda bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": ["../../packages/db/generated/**/*.node"],
    },
  },
}

export default config
