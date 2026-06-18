import { NextRequest, NextResponse } from "next/server"
import { merchantSignIn } from "@pulse/auth/merchant"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? ""

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url))
  }

  try {
    await merchantSignIn("credentials", {
      type:          "bot_token",
      botLoginToken: token,
      redirectTo:    "/dashboard",
    })
  } catch (err) {
    // NEXT_REDIRECT must propagate — Next.js converts it to a 302
    if (err && typeof err === "object" && "digest" in err) throw err
    console.error("[bot-login] error:", err)
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url))
  }

  return NextResponse.redirect(new URL("/dashboard", request.url))
}
