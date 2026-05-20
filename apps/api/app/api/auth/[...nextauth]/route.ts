import type { NextRequest } from "next/server"
import { handlers } from "@pulse/auth/user"

export function GET(request: NextRequest) {
  return handlers.GET(request as unknown as Parameters<typeof handlers.GET>[0])
}

export function POST(request: NextRequest) {
  return handlers.POST(request as unknown as Parameters<typeof handlers.POST>[0])
}
