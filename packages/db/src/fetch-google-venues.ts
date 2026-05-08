import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { VenueCategory } from "../generated"

type GoogleTextSearchResponse = {
  status: string
  error_message?: string
  results?: {
    place_id: string
    name: string
    formatted_address?: string
    geometry?: { location?: { lat: number; lng: number } }
    rating?: number
    user_ratings_total?: number
    types?: string[]
  }[]
}

type GoogleDetailsResponse = {
  status: string
  error_message?: string
  result?: {
    place_id: string
    name: string
    formatted_address?: string
    formatted_phone_number?: string
    international_phone_number?: string
    website?: string
    url?: string
    rating?: number
    user_ratings_total?: number
    opening_hours?: { weekday_text?: string[] }
    geometry?: { location?: { lat: number; lng: number } }
    types?: string[]
  }
}

function parseArgs() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--")
  const query = args.find((arg) => arg.startsWith("--query="))?.slice("--query=".length)
  const city = args.find((arg) => arg.startsWith("--city="))?.slice("--city=".length)
  const country = args.find((arg) => arg.startsWith("--country="))?.slice("--country=".length) ?? "Serbia"
  const out = args.find((arg) => arg.startsWith("--out="))?.slice("--out=".length)
  const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 20)
  if (!query) throw new Error("Missing --query, for example --query=\"coffee Belgrade\"")
  if (!city) throw new Error("Missing --city, for example --city=Belgrade")
  return {
    query,
    city,
    country,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.round(limit))) : 20,
    out: resolve(process.cwd(), out ?? `src/data/google-${city.toLowerCase().replace(/\s+/g, "-")}.json`),
  }
}

function categoryFromTypes(types: string[] | undefined): VenueCategory {
  const set = new Set(types ?? [])
  if (set.has("cafe") || set.has("bakery")) return "CAFE"
  if (set.has("restaurant") || set.has("meal_takeaway") || set.has("bar")) return "RESTAURANT"
  if (set.has("store") || set.has("shopping_mall")) return "RETAIL"
  if (set.has("beauty_salon") || set.has("hair_care") || set.has("spa")) return "SERVICE"
  return "OTHER"
}

function googleUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${path}/json`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url
}

async function googleFetch<T>(url: URL): Promise<T & { status: string; error_message?: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google request failed: ${res.status} ${res.statusText}`)
  const json = await res.json() as T & { status: string; error_message?: string }
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    throw new Error(`Google status ${json.status}${json.error_message ? `: ${json.error_message}` : ""}`)
  }
  return json
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required")
  const { query, city, country, limit, out } = parseArgs()

  const search = await googleFetch<GoogleTextSearchResponse>(googleUrl("textsearch", {
    query,
    key: apiKey,
    language: "en",
  }))

  const results = (search.results ?? []).slice(0, limit)
  const venues = []

  for (const item of results) {
    const details = await googleFetch<GoogleDetailsResponse>(googleUrl("details", {
      place_id: item.place_id,
      key: apiKey,
      language: "en",
      fields: [
        "place_id",
        "name",
        "formatted_address",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "url",
        "rating",
        "user_ratings_total",
        "opening_hours/weekday_text",
        "geometry/location",
        "types",
      ].join(","),
    }))
    const place = details.result
    if (!place?.geometry?.location) continue

    venues.push({
      sourceProvider: "google_maps",
      sourcePlaceId: place.place_id,
      sourceUrl: place.url,
      name: place.name,
      category: categoryFromTypes(place.types ?? item.types),
      description: undefined,
      address: place.formatted_address ?? item.formatted_address ?? "",
      city,
      country,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      phone: place.international_phone_number ?? place.formatted_phone_number,
      website: place.website,
      instagram: undefined,
      openingHoursText: place.opening_hours?.weekday_text?.join(" | "),
      googleRating: place.rating ?? item.rating,
      googleReviews: place.user_ratings_total ?? item.user_ratings_total,
      specialOffers: [],
      isPartner: false,
    })
  }

  await writeFile(out, `${JSON.stringify(venues, null, 2)}\n`, "utf8")
  console.log(`Saved ${venues.length} Google Places venues to ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
