import type { ImportVenue } from "./venue-imports"

type GoogleVenueCategory = "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER"

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

function categoryFromTypes(types: string[] | undefined): GoogleVenueCategory {
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
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Google request failed: ${response.status} ${response.statusText}`)
  const json = (await response.json()) as T & { status: string; error_message?: string }
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    throw new Error(`Google status ${json.status}${json.error_message ? `: ${json.error_message}` : ""}`)
  }
  return json
}

export async function fetchGoogleVenues({
  apiKey,
  query,
  city,
  country,
  limit,
}: {
  apiKey: string
  query: string
  city: string
  country: string
  limit: number
}) {
  const search = await googleFetch<GoogleTextSearchResponse>(googleUrl("textsearch", {
    query,
    key: apiKey,
    language: "en",
  }))

  const results = (search.results ?? []).slice(0, limit)
  const venues: ImportVenue[] = []

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
      ...(place.url ? { sourceUrl: place.url } : {}),
      name: place.name,
      category: categoryFromTypes(place.types ?? item.types),
      address: place.formatted_address ?? item.formatted_address ?? "",
      city,
      country,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      ...(place.international_phone_number || place.formatted_phone_number
        ? { phone: place.international_phone_number ?? place.formatted_phone_number }
        : {}),
      ...(place.website ? { website: place.website } : {}),
      ...(place.opening_hours?.weekday_text ? { openingHoursText: place.opening_hours.weekday_text.join(" | ") } : {}),
      ...(typeof (place.rating ?? item.rating) === "number" ? { googleRating: place.rating ?? item.rating } : {}),
      ...(typeof (place.user_ratings_total ?? item.user_ratings_total) === "number"
        ? { googleReviews: place.user_ratings_total ?? item.user_ratings_total }
        : {}),
      specialOffers: [],
      isPartner: false,
    })
  }

  return venues
}
