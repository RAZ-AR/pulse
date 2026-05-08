import { db } from "@pulse/db"
import { merchantAuth } from "@pulse/auth/merchant"
import {
  findExistingVenue,
  normalizeImportVenue,
  previewVenueImports,
  summarizeImportRows,
  toVenueData,
  type ImportVenue,
} from "@/lib/venue-imports"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await merchantAuth()
  const merchantId = (session as { merchant?: { id: string } } | null)?.merchant?.id
  if (!merchantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as { venues?: unknown; city?: unknown; confirmation?: unknown }
  if (body.confirmation !== "APPLY") {
    return NextResponse.json({ error: "Type APPLY to confirm this import" }, { status: 400 })
  }
  if (!Array.isArray(body.venues)) {
    return NextResponse.json({ error: "venues must be an array" }, { status: 400 })
  }

  const cityFilter = typeof body.city === "string" && body.city !== "All" ? body.city : undefined
  const venues = body.venues as ImportVenue[]
  const previewRows = await previewVenueImports(db, venues, cityFilter)
  const invalidRows = previewRows.filter((row) => row.action === "invalid")
  if (invalidRows.length > 0) {
    return NextResponse.json(
      {
        error: "Fix invalid rows before applying import",
        rows: previewRows,
        summary: summarizeImportRows(previewRows),
      },
      { status: 400 },
    )
  }

  const appliedRows = []

  for (const [index, venue] of venues.entries()) {
    if (cityFilter && venue.city !== cityFilter) continue

    const normalized = normalizeImportVenue(venue)
    const existing = await findExistingVenue(db, normalized)
    const data = toVenueData(normalized)

    if (existing) {
      await db.venue.update({ where: { id: existing.id }, data })
    } else {
      const created = await db.venue.create({ data })
      appliedRows.push({
        index,
        action: "create" as const,
        existingId: created.id,
        existingName: created.name,
        errors: [],
      })
      continue
    }

    appliedRows.push({
      index,
      action: "update" as const,
      existingId: existing.id,
      existingName: existing.name,
      errors: [],
    })
  }

  const summary = summarizeImportRows(appliedRows)
  await db.venueImportLog.create({
    data: {
      merchantId,
      city: cityFilter ?? null,
      source: "google_maps",
      total: summary.total,
      created: summary.create,
      updated: summary.update,
      invalid: summary.invalid,
      items: appliedRows,
    },
  })

  return NextResponse.json({
    rows: appliedRows,
    summary,
  })
}
