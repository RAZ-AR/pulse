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
}

export default config
