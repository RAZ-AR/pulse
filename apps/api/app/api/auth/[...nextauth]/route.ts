import type { NextRequest } from "next/server"
import { handlers } from "@pulse/auth/user"

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>
}

export function GET(request: NextRequest, _context: AuthRouteContext) {
  return handlers.GET(request as unknown as Parameters<typeof handlers.GET>[0])
}

export function POST(request: NextRequest, _context: AuthRouteContext) {
  return handlers.POST(request as unknown as Parameters<typeof handlers.POST>[0])
}
