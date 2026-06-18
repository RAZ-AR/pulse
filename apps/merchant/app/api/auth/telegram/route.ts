import { NextRequest, NextResponse } from "next/server"
import { merchantSignIn } from "@pulse/auth/merchant"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())

  if (!params.hash || !params.id) {
    return NextResponse.redirect(new URL("/login?error=telegram_invalid", request.url))
  }

  try {
    await merchantSignIn("credentials", {
      type:         "telegram",
      telegramData: JSON.stringify(params),
      redirectTo:   "/dashboard",
    })
  } catch (err) {
    // NEXT_REDIRECT errors must propagate — Next.js converts them to 302
    if (err && typeof err === "object" && "digest" in err) throw err
    console.error("[telegram-route] error:", err)
    return NextResponse.redirect(new URL("/login?error=telegram_failed", request.url))
  }

  return NextResponse.redirect(new URL("/dashboard", request.url))
}
