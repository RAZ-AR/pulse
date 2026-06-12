/**
 * OpenStreetMap → Venue importer (Places P1).
 *
 * Pulls cafes / restaurants / shops / beauty / fitness / yoga for a city from
 * the Overpass API and upserts them into the Venue table. Free + ODbL (needs
 * OSM attribution in the UI). Dedups by osmId, then by name+city+address so it
 * never clobbers existing partner venues — it only links/refreshes light fields.
 */
import type { PrismaClient, VenueCategory } from "@pulse/db"

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"

export type City = { name: string; country: string; bbox: [number, number, number, number] } // [south, west, north, east]

export const CITIES: City[] = [
  { name: "Belgrade", country: "Serbia", bbox: [44.70, 20.30, 44.92, 20.62] },
  { name: "Novi Sad", country: "Serbia", bbox: [45.19, 19.74, 45.33, 19.92] },
]

type OsmElement = {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function buildQuery(bbox: [number, number, number, number]): string {
  const b = bbox.join(",")
  return `[out:json][timeout:180];
(
  nwr["amenity"~"^(cafe|bar|pub|restaurant|fast_food)$"]["name"](${b});
  nwr["shop"]["name"](${b});
  nwr["leisure"~"^(fitness_centre|sports_centre|spa)$"]["name"](${b});
  nwr["amenity"~"^(gym)$"]["name"](${b});
);
out center tags;`
}

function categoryOf(tags: Record<string, string>): VenueCategory {
  const amenity = tags.amenity ?? ""
  const shop = tags.shop ?? ""
  const leisure = tags.leisure ?? ""
  const sport = tags.sport ?? ""

  if (sport.includes("yoga") || tags.yoga === "yes") return "YOGA"
  if (leisure === "fitness_centre" || leisure === "sports_centre" || amenity === "gym") {
    return sport.includes("yoga") ? "YOGA" : "FITNESS"
  }
  if (["hairdresser", "beauty", "nail_salon", "cosmetics", "massage", "tattoo"].includes(shop) || leisure === "spa") {
    return "BEAUTY"
  }
  if (amenity === "cafe" || amenity === "bar" || amenity === "pub") return "CAFE"
  if (amenity === "restaurant" || amenity === "fast_food") return "RESTAURANT"
  if (shop) return "RETAIL"
  return "SERVICE"
}

function addressOf(tags: Record<string, string>, city: string): string {
  const street = tags["addr:street"]
  const num = tags["addr:housenumber"]
  if (street) return num ? `${street} ${num}` : street
  return tags["addr:full"] ?? tags["addr:suburb"] ?? tags["addr:city"] ?? city
}

export type OsmSummary = { city: string; fetched: number; created: number; linked: number; updated: number; skipped: number; error?: string }

async function fetchCity(city: City): Promise<OsmElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ayoo-places/1.0" },
    body: "data=" + encodeURIComponent(buildQuery(city.bbox)),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${city.name}`)
  const json = (await res.json()) as { elements?: OsmElement[] }
  return json.elements ?? []
}

export async function importCity(db: PrismaClient, city: City): Promise<OsmSummary> {
  const elements = await fetchCity(city)
  const summary: OsmSummary = { city: city.name, fetched: elements.length, created: 0, linked: 0, updated: 0, skipped: 0 }

  for (const el of elements) {
    const tags = el.tags ?? {}
    const name = tags.name?.trim()
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!name || lat == null || lng == null) { summary.skipped++; continue }

    const osmId = `${el.type}/${el.id}`
    const data = {
      name,
      category: categoryOf(tags),
      address: addressOf(tags, city.name),
      city: city.name,
      country: city.country,
      lat,
      lng,
      ...(tags.phone || tags["contact:phone"] ? { phone: tags.phone ?? tags["contact:phone"] } : {}),
      ...(tags.website || tags["contact:website"] ? { website: tags.website ?? tags["contact:website"] } : {}),
      ...(tags.opening_hours ? { openingHoursText: tags.opening_hours } : {}),
    }

    // 1) already linked to this OSM element → refresh light fields
    const byOsm = await db.venue.findUnique({ where: { osmId }, select: { id: true } })
    if (byOsm) {
      await db.venue.update({ where: { id: byOsm.id }, data: { ...data, sourceUpdatedAt: new Date() } })
      summary.updated++
      continue
    }

    // 2) same place already exists (e.g. a partner) → link osmId, don't clobber
    const existing = await db.venue.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        city: { equals: city.name, mode: "insensitive" },
      },
      select: { id: true },
    })
    if (existing) {
      await db.venue.update({ where: { id: existing.id }, data: { osmId, sourceUpdatedAt: new Date() } })
      summary.linked++
      continue
    }

    // 3) brand new
    await db.venue.create({
      data: {
        ...data,
        photos: [],
        osmId,
        sourceProvider: "osm",
        sourcePlaceId: osmId,
        sourceUrl: `https://www.openstreetmap.org/${osmId}`,
        sourceUpdatedAt: new Date(),
      },
    })
    summary.created++
  }

  return summary
}

export async function importAllCities(db: PrismaClient): Promise<OsmSummary[]> {
  const out: OsmSummary[] = []
  for (const city of CITIES) {
    try {
      out.push(await importCity(db, city))
    } catch (e) {
      out.push({ city: city.name, fetched: 0, created: 0, linked: 0, updated: 0, skipped: 0, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}
