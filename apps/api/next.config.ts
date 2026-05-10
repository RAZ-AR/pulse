import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
    "@pulse/jobs",
  ],
  experimental: {
    // Include Prisma engine binary for all app routes.
    // Glob is relative to this app's root (apps/api/); ../../ reaches the monorepo root.
    outputFileTracingIncludes: {
      "app/**": ["../../packages/db/generated/**/*.node"],
    },
  },
}

export default config
