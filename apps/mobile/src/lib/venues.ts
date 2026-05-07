export type VenueCategory = "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER"

export type CityOption = {
  name: "Belgrade" | "Novi Sad"
  label: string
  lat: number
  lng: number
  radiusKm: number
}

export type VenueFilter = {
  key: string
  label: string
  category?: VenueCategory
}

export const DEFAULT_CITY: CityOption = { name: "Belgrade", label: "Belgrade", lat: 44.8125, lng: 20.4612, radiusKm: 12 }

export const CITY_OPTIONS: CityOption[] = [
  DEFAULT_CITY,
  { name: "Novi Sad", label: "Novi Sad", lat: 45.2671, lng: 19.8335, radiusKm: 12 },
]

export const DEFAULT_VENUE_FILTER: VenueFilter = { key: "all", label: "All" }

export const VENUE_FILTERS: VenueFilter[] = [
  DEFAULT_VENUE_FILTER,
  { key: "cafe", label: "Cafe", category: "CAFE" },
  { key: "coffee", label: "Coffee", category: "CAFE" },
  { key: "restaurant", label: "Restaurant", category: "RESTAURANT" },
  { key: "japanese", label: "Japanese", category: "RESTAURANT" },
  { key: "pizza", label: "Pizza", category: "RESTAURANT" },
  { key: "bar", label: "Bar", category: "RESTAURANT" },
  { key: "beauty", label: "Beauty", category: "SERVICE" },
  { key: "stores", label: "Stores", category: "RETAIL" },
]

export function resolveCity(name: string | null | undefined): CityOption {
  return CITY_OPTIONS.find((city) => city.name.toLowerCase() === name?.toLowerCase()) ?? DEFAULT_CITY
}

export function nextCity(name: string | null | undefined): CityOption {
  const current = resolveCity(name)
  const currentIndex = CITY_OPTIONS.findIndex((city) => city.name === current.name)
  return CITY_OPTIONS[(currentIndex + 1) % CITY_OPTIONS.length] ?? DEFAULT_CITY
}
