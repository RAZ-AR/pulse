import { merchantAuthEdge } from "@pulse/auth/merchant-edge"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const session = await merchantAuthEdge()
  const isAuthed = !!session

  const { pathname } = req.nextUrl

  if (!isAuthed && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  if (isAuthed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
}
