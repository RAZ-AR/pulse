/**
 * POST /api/support-report
 * Public endpoint for error & problem reports (mobile app, server, landing).
 * Forwards to the support bot. Body: { message, context?, source?, userId? }
 */
import { NextResponse } from "next/server"
import { sendErrorReport } from "@pulse/bot/support"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message ?? "").trim().slice(0, 2000)
    if (!message) {
      return NextResponse.json({ ok: false, error: "message required" }, { status: 400, headers: CORS })
    }
    await sendErrorReport({
      message,
      context: body.context ? String(body.context).slice(0, 500) : undefined,
      source: body.source ? String(body.source).slice(0, 60) : "app",
      userId: body.userId ? String(body.userId).slice(0, 60) : undefined,
    })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    console.error("[support-report] error:", e)
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS })
  }
}
