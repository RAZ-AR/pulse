/**
 * POST /api/partner-lead
 * Public endpoint for the landing partner form. Forwards the application to the
 * support bot (admins accept/reject there). Body: { name, contact, source?, lang? }
 */
import { NextResponse } from "next/server"
import { sendPartnerLead } from "@pulse/bot/support"

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
    const name = String(body.name ?? "").trim().slice(0, 120)
    const contact = String(body.contact ?? "").trim().slice(0, 120)
    if (!name || !contact) {
      return NextResponse.json({ ok: false, error: "name and contact required" }, { status: 400, headers: CORS })
    }
    await sendPartnerLead({
      name,
      contact,
      source: body.source ? String(body.source).slice(0, 60) : "landing",
      lang: body.lang ? String(body.lang).slice(0, 8) : undefined,
    })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    console.error("[partner-lead] error:", e)
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS })
  }
}
