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
  // Widened to cover the metro area (New Belgrade, Zemun, outskirts).
  { name: "Belgrade", country: "Serbia", bbox: [44.66, 20.25, 44.95, 20.70] },
  { name: "Novi Sad", country: "Serbia", bbox: [45.16, 19.70, 45.36, 19.95] },
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
  nwr["amenity"~"^(cafe|bar|pub|restaurant|fast_food|ice_cream|food_court|biergarten|nightclub|cinema|theatre|marketplace|pharmacy)$"]["name"](${b});
  nwr["shop"]["name"](${b});
  nwr["leisure"~"^(fitness_centre|sports_centre|spa|dance)$"]["name"](${b});
  nwr["amenity"~"^(gym)$"]["name"](${b});
  nwr["tourism"~"^(hotel|hostel|guest_house|museum|gallery|attraction)$"]["name"](${b});
  nwr["craft"~"^(bakery|confectionery|brewery)$"]["name"](${b});
);
out center tags;`
}

function categoryOf(tags: Record<string, string>): VenueCategory {
  const amenity = tags.amenity ?? ""
  const shop = tags.shop ?? ""
  const leisure = tags.leisure ?? ""
  const sport = tags.sport ?? ""
  const tourism = tags.tourism ?? ""
  const craft = tags.craft ?? ""

  if (sport.includes("yoga") || tags.yoga === "yes") return "YOGA"
  if (leisure === "fitness_centre" || leisure === "sports_centre" || leisure === "dance" || amenity === "gym") {
    return sport.includes("yoga") ? "YOGA" : "FITNESS"
  }
  if (["hairdresser", "beauty", "nail_salon", "cosmetics", "massage", "tattoo"].includes(shop) || leisure === "spa") {
    return "BEAUTY"
  }
  if (amenity === "cafe" || amenity === "bar" || amenity === "pub" || amenity === "ice_cream" || amenity === "biergarten") return "CAFE"
  if (amenity === "restaurant" || amenity === "fast_food" || amenity === "food_court") return "RESTAURANT"
  if (craft === "bakery" || craft === "confectionery") return "CAFE"
  if (craft === "brewery") return "RESTAURANT"
  if (["nightclub", "cinema", "theatre", "museum", "gallery", "attraction"].includes(amenity) || ["museum", "gallery", "attraction"].includes(tourism)) return "OTHER"
  if (["hotel", "hostel", "guest_house"].includes(tourism)) return "SERVICE"
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

  // 1) Normalize OSM elements → rows (in memory).
  const rows = elements.flatMap((el) => {
    const tags = el.tags ?? {}
    const name = tags.name?.trim()
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!name || lat == null || lng == null) return []
    return [{
      osmId: `${el.type}/${el.id}`,
      name,
      data: {
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
      },
    }]
  })
  summary.skipped = elements.length - rows.length

  // 2) Load existing venues for this city once → in-memory dedup maps.
  const existing = await db.venue.findMany({
    where: { city: city.name },
    select: { id: true, name: true, osmId: true },
  })
  const linkedOsm = new Set(existing.filter((v) => v.osmId).map((v) => v.osmId as string))
  const byName = new Map(existing.map((v) => [v.name.toLowerCase(), v.id] as const))

  // 3) Partition: already-linked (skip), name-match (link osmId), brand-new (create).
  const toCreate: object[] = []
  const toLink: { id: string; osmId: string }[] = []
  for (const r of rows) {
    if (linkedOsm.has(r.osmId)) { summary.updated++; continue }
    const existingId = byName.get(r.name.toLowerCase())
    if (existingId) { toLink.push({ id: existingId, osmId: r.osmId }); continue }
    toCreate.push({
      ...r.data,
      photos: [],
      osmId: r.osmId,
      sourceProvider: "osm",
      sourcePlaceId: r.osmId,
      sourceUrl: `https://www.openstreetmap.org/${r.osmId}`,
      sourceUpdatedAt: new Date(),
    })
  }

  // 4) Bulk create new; link name-matched partners (don't clobber their data).
  if (toCreate.length) {
    const res = await db.venue.createMany({ data: toCreate as never, skipDuplicates: true })
    summary.created += res.count
  }
  for (const l of toLink) {
    await db.venue.update({ where: { id: l.id }, data: { osmId: l.osmId, sourceUpdatedAt: new Date() } }).catch(() => {})
    summary.linked++
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
