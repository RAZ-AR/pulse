/**
 * GET /api/places/autocomplete?input=...&city=...
 *
 * Address autocomplete proxy.
 * Primary: Google Places API (if GOOGLE_PLACES_API_KEY is set).
 * Fallback: Photon OSM (free, no key needed, Serbia bbox).
 *
 * Returns: { predictions: [{ mainText, secondaryText, description, placeId, lat, lng }] }
 */
import { NextResponse } from "next/server"

// Serbia bounding box: west, south, east, north
const SERBIA_BBOX = "18.8,41.8,23.0,46.2"

type Prediction = {
  mainText: string
  secondaryText: string
  description: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get("input")?.trim() ?? ""
  const city = searchParams.get("city")?.trim() ?? ""

  if (input.length < 2) return NextResponse.json({ predictions: [] })

  // Try Google Places first if key available
  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  if (googleKey) {
    const google = await googleAutocomplete(input, city, googleKey)
    if (google !== null) return NextResponse.json({ predictions: google })
    // null = error → fall through to Photon
  }

  // Photon fallback (always available)
  return NextResponse.json({ predictions: await photonAutocomplete(input, city) })
}

// ── Photon (photon.komoot.io) — free, OSM-based ──────────────────
async function photonAutocomplete(input: string, city: string): Promise<Prediction[]> {
  const q = city ? `${input}, ${city}, Serbia` : `${input}, Serbia`
  const url =
    `https://photon.komoot.io/api/` +
    `?q=${encodeURIComponent(q)}` +
    `&limit=7` +
    `&bbox=${SERBIA_BBOX}` +
    `&lang=en`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ayoo-partner-app/1.0" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []

    const data = (await res.json()) as { features?: PhotonFeature[] }
    const seen = new Set<string>()

    return (data.features ?? [])
      .map((f): Prediction | null => {
        const p = f.properties ?? {}
        const road = p.street || p.name || ""
        const num = p.housenumber || ""
        const addr = road ? road + (num ? `, ${num}` : "") : ""
        const cityName = p.city || p.town || p.village || p.municipality || ""
        const [lon, lat] = f.geometry?.coordinates ?? [null, null]
        if (!addr) return null
        const key = addr.toLowerCase()
        if (seen.has(key)) return null
        seen.add(key)
        return {
          mainText: addr,
          secondaryText: cityName,
          description: [addr, cityName, "Serbia"].filter(Boolean).join(", "),
          placeId: null,
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lon === "number" ? lon : null,
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
    if (json.status !== "OK") return null // triggers Photon fallback
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

// ── Types ─────────────────────────────────────────────────────────
type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string; street?: string; housenumber?: string
    city?: string; town?: string; village?: string; municipality?: string
  }
}
type GoogleAutocompleteResponse = {
  status: string
  predictions?: Array<{
    place_id: string; description: string
    structured_formatting?: { main_text?: string; secondary_text?: string }
  }>
}
