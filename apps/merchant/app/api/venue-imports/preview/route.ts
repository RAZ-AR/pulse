import { db } from "@pulse/db"
import { merchantAuth } from "@pulse/auth/merchant"
import { NextResponse } from "next/server"

type ImportVenue = {
  sourceProvider?: string
  sourcePlaceId?: string
  existingVenueId?: string
  name?: string
  category?: string
  address?: string
  city?: string
  country?: string
  lat?: number
  lng?: number
  phone?: string
  website?: string
  instagram?: string
  openingHoursText?: string
  googleRating?: number
  googleReviews?: number
  specialOffers?: string[]
  isPartner?: boolean
  pointsPerCurrency?: number
  maxDiscountPercent?: number
}

type PreviewRow = {
  index: number
  action: "create" | "update" | "invalid"
  existingId: string | null
  existingName: string | null
  errors: string[]
}

const REQUIRED: (keyof ImportVenue)[] = [
  "sourceProvider",
  "sourcePlaceId",
  "name",
  "category",
  "address",
  "city",
  "lat",
  "lng",
]

const VALID_CATEGORIES = ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]

function validationErrors(venue: ImportVenue) {
  const errors: string[] = []
  for (const field of REQUIRED) {
    const value = venue[field]
    if (value === undefined || value === null || value === "") errors.push(`${field} is required`)
  }
  if (!VALID_CATEGORIES.includes(String(venue.category))) errors.push("category is invalid")
  if (typeof venue.lat !== "number" || venue.lat < -90 || venue.lat > 90) errors.push("lat must be a valid latitude")
  if (typeof venue.lng !== "number" || venue.lng < -180 || venue.lng > 180) errors.push("lng must be a valid longitude")
  if (venue.googleRating !== undefined && (venue.googleRating < 0 || venue.googleRating > 5)) {
    errors.push("googleRating must be 0-5")
  }
  return errors
}

export async function POST(request: Request) {
  const session = await merchantAuth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as { venues?: unknown; city?: unknown }
  if (!Array.isArray(body.venues)) {
    return NextResponse.json({ error: "venues must be an array" }, { status: 400 })
  }

  const cityFilter = typeof body.city === "string" && body.city !== "All" ? body.city : undefined
  const venues = body.venues as ImportVenue[]
  const rows: PreviewRow[] = []

  for (const [index, venue] of venues.entries()) {
    if (cityFilter && venue.city !== cityFilter) continue

    const errors = validationErrors(venue)
    if (errors.length > 0) {
      rows.push({ index, action: "invalid", existingId: null, existingName: null, errors })
      continue
    }

    const sourceProvider = venue.sourceProvider as string
    const sourcePlaceId = venue.sourcePlaceId as string
    const name = venue.name as string
    const city = venue.city as string
    const address = venue.address as string

    const existing = await db.venue.findFirst({
      where: {
        OR: [
          {
            sourceProvider,
            sourcePlaceId,
          },
          ...(venue.existingVenueId ? [{ id: venue.existingVenueId }] : []),
          {
            name: { equals: name, mode: "insensitive" },
            city: { equals: city, mode: "insensitive" },
            address: { equals: address, mode: "insensitive" },
          },
        ],
      },
      select: { id: true, name: true },
    })

    rows.push({
      index,
      action: existing ? "update" : "create",
      existingId: existing?.id ?? null,
      existingName: existing?.name ?? null,
      errors,
    })
  }

  return NextResponse.json({
    rows,
    summary: {
      total: rows.length,
      create: rows.filter((row) => row.action === "create").length,
      update: rows.filter((row) => row.action === "update").length,
      invalid: rows.filter((row) => row.action === "invalid").length,
    },
  })
}
