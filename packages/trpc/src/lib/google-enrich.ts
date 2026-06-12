/**
 * Lazy Google Places enrichment for a venue (Places P3).
 *
 * On venue detail open, if the row is stale, fill rating / review count /
 * hours / price level / Google Maps link from Google Place Details and cache
 * them on the Venue row (lastEnrichedAt = TTL marker). Best-effort: never
 * throws to the caller. We do NOT store Google review *text* (ToS) — only the
 * aggregate rating + a deep link, shown as a chip in the UI.
 */
import type { PrismaClient } from "@pulse/db"

const TTL_DAYS = 30
const KEY = process.env.GOOGLE_CLOUD_API_KEY

type FindPlace = { status: string; candidates?: { place_id: string }[] }
type Details = {
  status: string
  result?: {
    rating?: number
    user_ratings_total?: number
    price_level?: number
    url?: string
    website?: string
    formatted_phone_number?: string
    opening_hours?: { weekday_text?: string[] }
  }
}

function isStale(lastEnrichedAt: Date | null | undefined): boolean {
  if (!lastEnrichedAt) return true
  return Date.now() - new Date(lastEnrichedAt).getTime() > TTL_DAYS * 86_400_000
}

async function gfetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${path}/json`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set("key", KEY as string)
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

type EnrichInput = {
  id: string
  name: string
  city: string
  lat: number
  lng: number
  phone: string | null
  website: string | null
  lastEnrichedAt: Date | null
}

/** Enrich if stale + key present. Returns true if the row was updated. */
export async function enrichVenueFromGoogle(db: PrismaClient, v: EnrichInput): Promise<boolean> {
  if (!KEY || !isStale(v.lastEnrichedAt)) return false

  const find = await gfetch<FindPlace>("findplacefromtext", {
    input: `${v.name} ${v.city}`,
    inputtype: "textquery",
    fields: "place_id",
    locationbias: `point:${v.lat},${v.lng}`,
  })
  // API broken (no billing / disabled / quota): bail WITHOUT marking, so it
  // retries once Google is configured. Only "OK"/"ZERO_RESULTS" are real answers.
  if (!find || (find.status !== "OK" && find.status !== "ZERO_RESULTS")) return false

  const placeId = find.candidates?.[0]?.place_id
  if (!placeId) {
    // Genuinely not on Google → mark so we don't re-query every open.
    await db.venue.update({ where: { id: v.id }, data: { lastEnrichedAt: new Date() } }).catch(() => {})
    return false
  }

  const details = await gfetch<Details>("details", {
    place_id: placeId,
    fields: "rating,user_ratings_total,price_level,url,website,formatted_phone_number,opening_hours",
  })
  if (!details || details.status !== "OK" || !details.result) return false
  const r = details.result

  await db.venue.update({
    where: { id: v.id },
    data: {
      lastEnrichedAt: new Date(),
      sourcePlaceId: placeId,
      ...(typeof r.rating === "number" ? { googleRating: r.rating } : {}),
      ...(typeof r.user_ratings_total === "number" ? { googleReviews: r.user_ratings_total } : {}),
      ...(typeof r.price_level === "number" ? { priceLevel: r.price_level } : {}),
      ...(r.url ? { googleMapsUrl: r.url } : {}),
      ...(r.opening_hours?.weekday_text?.length ? { openingHoursText: r.opening_hours.weekday_text.join("\n") } : {}),
      ...(!v.phone && r.formatted_phone_number ? { phone: r.formatted_phone_number } : {}),
      ...(!v.website && r.website ? { website: r.website } : {}),
    },
  }).catch(() => {})
  return true
}
