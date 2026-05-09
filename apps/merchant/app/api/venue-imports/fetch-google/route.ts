import { merchantAuth } from "@pulse/auth/merchant"
import { fetchGoogleVenues } from "@/lib/google-places"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await merchantAuth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 500 })

  const body = (await request.json()) as { query?: unknown; city?: unknown; country?: unknown; limit?: unknown }
  const query = typeof body.query === "string" ? body.query.trim() : ""
  const city = typeof body.city === "string" ? body.city.trim() : ""
  const country = typeof body.country === "string" && body.country.trim() ? body.country.trim() : "Serbia"
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit)
    ? Math.max(1, Math.min(20, Math.round(body.limit)))
    : 10

  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 })
  if (!city) return NextResponse.json({ error: "city is required" }, { status: 400 })

  try {
    const venues = await fetchGoogleVenues({ apiKey, query, city, country, limit })

    return NextResponse.json({
      venues,
      summary: {
        total: venues.length,
        query,
        city,
        country,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google fetch failed" },
      { status: 502 },
    )
  }
}
