/**
 * GET /api/places/autocomplete?input=...&city=...
 *
 * Address autocomplete for the merchant dashboard.
 * Primary: Google Places API (if GOOGLE_PLACES_API_KEY is set).
 * Fallback: Nominatim (OSM, free, no key) — structured Serbian addresses with
 * coordinates. Low-volume merchant typing fits its usage policy (≤1 req/s).
 *
 * Returns: { predictions: [{ mainText, secondaryText, description, placeId, lat, lng }] }
 */
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get("input")?.trim() ?? ""
  const city = searchParams.get("city")?.trim() ?? ""

  if (input.length < 2) return NextResponse.json({ predictions: [] })

  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  if (googleKey) {
    const google = await googleAutocomplete(input, city, googleKey)
    if (google !== null) return NextResponse.json({ predictions: google })
  }

  return NextResponse.json({ predictions: await nominatimAutocomplete(input, city) })
}

type Prediction = {
  mainText: string
  secondaryText: string
  description: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

// ── Nominatim (nominatim.openstreetmap.org) — free, OSM-based ─────
type NominatimResult = {
  lat: string
  lon: string
  display_name?: string
  name?: string
  address?: Record<string, string>
}

async function nominatimAutocomplete(input: string, city: string): Promise<Prediction[]> {
  const q = city ? `${input}, ${city}` : input
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}` +
    `&format=jsonv2&limit=7&countrycodes=rs&addressdetails=1`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ayoo-partner-app/1.0 (https://ayoo.space)", "Accept-Language": "sr,en" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []

    const data = (await res.json()) as NominatimResult[]
    const seen = new Set<string>()

    return (data ?? [])
      .map((r): Prediction | null => {
        const a = r.address ?? {}
        const road = a.road || a.pedestrian || a.footway || a.cycleway || ""
        const house = a.house_number || ""
        const named = r.name || a.amenity || a.shop || a.tourism || a.building || ""
        const mainText = (road ? road + (house ? ` ${house}` : "") : named) || (r.display_name ?? "").split(",")[0]!.trim()
        const cityName = a.city || a.town || a.village || a.municipality || a.county || city
        const secondaryText = [a.suburb, cityName].filter(Boolean).join(", ")
        const lat = parseFloat(r.lat)
        const lng = parseFloat(r.lon)
        if (!mainText || Number.isNaN(lat) || Number.isNaN(lng)) return null
        const key = `${mainText.toLowerCase()}|${cityName.toLowerCase()}`
        if (seen.has(key)) return null
        seen.add(key)
        return {
          mainText,
          secondaryText,
          description: [mainText, secondaryText, "Serbia"].filter(Boolean).join(", "),
          placeId: null,
          lat,
          lng,
        }
      })
      .filter((x): x is Prediction => x !== null)
  } catch {
    return []
  }
}

// ── Google Places (optional) ──────────────────────────────────────
async function googleAutocomplete(
  input: string,
  city: string,
  apiKey: string,
): Promise<Prediction[] | null> {
  const q = city ? `${input}, ${city}` : input
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
  url.searchParams.set("input", q)
  url.searchParams.set("types", "address")
  url.searchParams.set("components", "country:rs")
  url.searchParams.set("language", "ru")
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    const json = (await res.json()) as GoogleAutocompleteResponse
    if (json.status === "ZERO_RESULTS") return []
    if (json.status !== "OK") return null
    return (json.predictions ?? []).slice(0, 6).map((p) => ({
      mainText: p.structured_formatting?.main_text || p.description.split(",")[0]!,
      secondaryText: p.structured_formatting?.secondary_text?.split(",")[0] || city,
      description: p.description,
      placeId: p.place_id,
      lat: null,
      lng: null,
    }))
  } catch {
    return null
  }
}

type GoogleAutocompleteResponse = {
  status: string
  predictions?: Array<{
    place_id: string; description: string
    structured_formatting?: { main_text?: string; secondary_text?: string }
  }>
}
