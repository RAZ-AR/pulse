const EARTH_RADIUS_KM = 6371

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000
}

/** Degrees of latitude per kilometre — constant */
const LAT_DEG_PER_KM = 1 / 111

/** Degrees of longitude per kilometre at a given latitude */
function lngDegPerKm(lat: number): number {
  return 1 / (111 * Math.cos((lat * Math.PI) / 180))
}

/** Bounding box for a circle — used in Prisma WHERE clauses before Haversine filter */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm * LAT_DEG_PER_KM
  const dLng = radiusKm * lngDegPerKm(lat)
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  }
}
