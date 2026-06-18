import type { NextConfig } from "next"
import path from "path"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
  ],
  // Don't bundle @pulse/db — let Node.js resolve it from node_modules
  // so the Prisma engine binary at packages/db/generated/ is found at runtime
  serverExternalPackages: ["@prisma/client", "@pulse/db"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/**": ["packages/db/generated/**/*.node"],
  },
}

export default config
