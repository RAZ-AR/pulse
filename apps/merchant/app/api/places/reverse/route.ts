/**
 * GET /api/places/reverse?lat=...&lng=...
 *
 * Reverse geocoding for the map pin — turns a dropped point into a human
 * address. Nominatim (OSM, free, no key). Low-volume (one call per pin move).
 *
 * Returns: { address: string, city: string } | { address: null, city: null }
 */
import { NextResponse } from "next/server"

type NominatimReverse = {
  name?: string
  display_name?: string
  address?: Record<string, string>
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get("lat") ?? "")
  const lng = parseFloat(searchParams.get("lng") ?? "")
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ address: null, city: null })
  }

  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=18`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ayoo-partner-app/1.0 (https://ayoo.space)", "Accept-Language": "sr,en" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return NextResponse.json({ address: null, city: null })

    const r = (await res.json()) as NominatimReverse
    const a = r.address ?? {}
    const road = a.road || a.pedestrian || a.footway || a.cycleway || ""
    const house = a.house_number || ""
    const named = r.name || a.amenity || a.shop || a.tourism || a.building || ""
    const address = (road ? road + (house ? ` ${house}` : "") : named) || (r.display_name ?? "").split(",")[0]!.trim() || ""
    const city = a.city || a.town || a.village || a.municipality || a.county || ""
    return NextResponse.json({ address: address || null, city: city || null })
  } catch {
    return NextResponse.json({ address: null, city: null })
  }
}
