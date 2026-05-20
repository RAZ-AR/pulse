import type { NextRequest } from "next/server"
import { merchantHandlers } from "@pulse/auth/merchant"

export function GET(request: NextRequest) {
  return merchantHandlers.GET(
    request as unknown as Parameters<typeof merchantHandlers.GET>[0],
  )
}

export function POST(request: NextRequest) {
  return merchantHandlers.POST(
    request as unknown as Parameters<typeof merchantHandlers.POST>[0],
  )
}
