import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: [
    "@pulse/auth",
    "@pulse/db",
    "@pulse/i18n",
    "@pulse/shared",
    "@pulse/trpc",
  ],
}

export default config
