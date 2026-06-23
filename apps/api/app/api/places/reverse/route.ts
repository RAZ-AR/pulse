/**
 * Turn a manually placed map pin into a human-readable address.
 * Nominatim/OSM is enough here: one request after click, drag, or geolocation.
 */
import { NextResponse } from "next/server"

type NominatimReverse = {
  name?: string
  display_name?: string
  address?: Record<string, string>
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lng = Number(searchParams.get("lng"))

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ address: null, city: null })
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("zoom", "18")

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ayoo-partner-app/1.0 (https://ayoo.space)",
        "Accept-Language": "sr,en",
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return NextResponse.json({ address: null, city: null })

    const result = (await response.json()) as NominatimReverse
    const address = result.address ?? {}
    const road = address.road || address.pedestrian || address.footway || address.cycleway || ""
    const house = address.house_number || ""
    const named = result.name || address.amenity || address.shop || address.tourism || address.building || ""
    const fallback = result.display_name?.split(",")[0]?.trim() || ""
    const label = road ? `${road}${house ? ` ${house}` : ""}` : named || fallback
    const city = address.city || address.town || address.village || address.municipality || address.county || ""

    return NextResponse.json({ address: label || null, city: city || null })
  } catch {
    return NextResponse.json({ address: null, city: null })
  }
}
