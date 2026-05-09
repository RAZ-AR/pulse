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
    // Ensure Prisma engine binaries are included in Vercel serverless bundles.
    // Without this, Next.js file tracing misses the .node files in the custom output path.
    outputFileTracingIncludes: {
      "**": ["../../packages/db/generated/**/*.node"],
    },
  },
}

export default config
