import type { NextRequest } from "next/server"
import { merchantHandlers } from "@pulse/auth/merchant"

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>
}

export function GET(request: NextRequest, _context: AuthRouteContext) {
  return merchantHandlers.GET(
    request as unknown as Parameters<typeof merchantHandlers.GET>[0],
  )
}

export function POST(request: NextRequest, _context: AuthRouteContext) {
  return merchantHandlers.POST(
    request as unknown as Parameters<typeof merchantHandlers.POST>[0],
  )
}
