// Client helper: turn a map point into an address via the merchant's reverse
// geocoding route (Nominatim/OSM, free). Returns null on failure so callers can
// keep the coordinates and let the merchant type the address manually.
export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string } | null> {
  try {
    const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`)
    const data = (await res.json()) as { address: string | null; city: string | null }
    if (!data.address) return null
    return { address: data.address, city: data.city ?? "" }
  } catch {
    return null
  }
}
