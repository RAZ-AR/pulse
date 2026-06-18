import type { NextConfig } from "next"
import path from "path"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
  ],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/**": ["apps/merchant/generated/**/*.node"],
  },
}

export default config
