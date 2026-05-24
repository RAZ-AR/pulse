import { NextResponse } from "next/server"

type GoogleDetailsResponse = {
  status: string
  error_message?: string
  result?: {
    place_id: string
    formatted_address?: string
    url?: string
    address_components?: {
      long_name: string
      short_name: string
      types: string[]
    }[]
    geometry?: { location?: { lat: number; lng: number } }
  }
}

function googleUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${path}/json`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url
}

function component(
  components: GoogleDetailsResponse["result"] extends infer R
    ? R extends { address_components?: infer C }
      ? C
      : never
    : never,
  type: string,
) {
  return components?.find((item) => item.types.includes(type))?.long_name ?? ""
}

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    // No Google key — return null fields gracefully so the client can handle it
    return NextResponse.json({
      placeId: null, address: null, city: null,
      formattedAddress: null, googleMapsUrl: null, lat: null, lng: null,
    })
  }

  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get("placeId")?.trim()
  if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 })

  const url = googleUrl("details", {
    place_id: placeId,
    key: apiKey,
    language: "sr",
    fields: "place_id,formatted_address,address_components,geometry/location,url",
  })

  const response = await fetch(url)
  const json = (await response.json()) as GoogleDetailsResponse

  if (json.status !== "OK" || !json.result) {
    return NextResponse.json(
      { error: json.error_message ?? `Google status ${json.status}` },
      { status: 502 },
    )
  }

  const parts = json.result.address_components ?? []
  const street = component(parts, "route")
  const number = component(parts, "street_number")
  const city =
    component(parts, "locality") ||
    component(parts, "postal_town") ||
    component(parts, "administrative_area_level_2")
  const address = street && number
    ? `${street}, ${number}`
    : street || json.result.formatted_address || ""

  return NextResponse.json({
    placeId: json.result.place_id,
    address,
    city,
    formattedAddress: json.result.formatted_address ?? address,
    googleMapsUrl: json.result.url ?? "",
    lat: json.result.geometry?.location?.lat ?? null,
    lng: json.result.geometry?.location?.lng ?? null,
  })
}
