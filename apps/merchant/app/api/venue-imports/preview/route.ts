import { db } from "@pulse/db"
import { merchantAuth } from "@pulse/auth/merchant"
import { previewVenueImports, summarizeImportRows } from "@/lib/venue-imports"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await merchantAuth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as { venues?: unknown; city?: unknown }
  if (!Array.isArray(body.venues)) {
    return NextResponse.json({ error: "venues must be an array" }, { status: 400 })
  }

  const cityFilter = typeof body.city === "string" && body.city !== "All" ? body.city : undefined
  const rows = await previewVenueImports(db, body.venues, cityFilter)

  return NextResponse.json({
    rows,
    summary: summarizeImportRows(rows),
  })
}
