"use client"

import { useMemo, useState } from "react"

type ImportVenue = {
  sourceProvider?: string
  sourcePlaceId?: string
  existingVenueId?: string
  name?: string
  category?: string
  address?: string
  city?: string
  country?: string
  lat?: number
  lng?: number
  phone?: string
  website?: string
  instagram?: string
  openingHoursText?: string
  googleRating?: number
  googleReviews?: number
  specialOffers?: string[]
  isPartner?: boolean
  pointsPerCurrency?: number
  maxDiscountPercent?: number
}

type ServerPreviewRow = {
  index: number
  action: "create" | "update" | "invalid"
  existingId: string | null
  existingName: string | null
  errors: string[]
}

type ServerPreview = {
  rows: ServerPreviewRow[]
  summary: {
    total: number
    create: number
    update: number
    invalid: number
  }
}

type PreviewRow = {
  venue: ImportVenue
  index: number
  errors: string[]
  action: "create" | "update"
  existingId?: string | null
  existingName?: string | null
}

const SAMPLE = `[
  {
    "sourceProvider": "google_maps",
    "sourcePlaceId": "demo_bg_jan",
    "existingVenueId": "venue_jan",
    "name": "JAN",
    "category": "RESTAURANT",
    "address": "Dure Jaksica 12, Stari Grad",
    "city": "Belgrade",
    "country": "Serbia",
    "lat": 44.8185,
    "lng": 20.4608,
    "phone": "+381 11 328 4410",
    "website": "https://janbelgrade.example",
    "instagram": "https://instagram.com/jan.belgrade",
    "openingHoursText": "Mon-Sat 12:00-23:00",
    "googleRating": 4.8,
    "googleReviews": 312,
    "specialOffers": ["-50% starter set", "Weekend tasting bonus"],
    "isPartner": true,
    "pointsPerCurrency": 0.008,
    "maxDiscountPercent": 50
  }
]`

const REQUIRED: (keyof ImportVenue)[] = [
  "sourceProvider",
  "sourcePlaceId",
  "name",
  "category",
  "address",
  "city",
  "lat",
  "lng",
]

function parseImportJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return { venues: [], error: "JSON must be an array of venues" }
    return { venues: parsed as ImportVenue[], error: "" }
  } catch (error) {
    return { venues: [], error: error instanceof Error ? error.message : "Invalid JSON" }
  }
}

function validationErrors(venue: ImportVenue) {
  const errors: string[] = []
  for (const field of REQUIRED) {
    const value = venue[field]
    if (value === undefined || value === null || value === "") errors.push(`${field} is required`)
  }
  if (typeof venue.lat !== "number" || venue.lat < -90 || venue.lat > 90) errors.push("lat must be a valid latitude")
  if (typeof venue.lng !== "number" || venue.lng < -180 || venue.lng > 180) errors.push("lng must be a valid longitude")
  if (venue.googleRating !== undefined && (venue.googleRating < 0 || venue.googleRating > 5)) errors.push("googleRating must be 0-5")
  return errors
}

function isServerPreview(value: unknown): value is ServerPreview {
  if (!value || typeof value !== "object") return false
  const preview = value as Partial<ServerPreview>
  return Array.isArray(preview.rows) && typeof preview.summary === "object"
}

export default function VenueImportsPage() {
  const [json, setJson] = useState(SAMPLE)
  const [cityFilter, setCityFilter] = useState("All")
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null)
  const [serverError, setServerError] = useState("")
  const [isPreviewing, setIsPreviewing] = useState(false)
  const parsed = useMemo(() => parseImportJson(json), [json])
  const localRows = useMemo(() => {
    return parsed.venues
      .map((venue, index): PreviewRow => ({
        venue,
        index,
        errors: validationErrors(venue),
        action: venue.existingVenueId ? "update" : "create",
      }))
      .filter((row) => cityFilter === "All" || row.venue.city === cityFilter)
  }, [cityFilter, parsed.venues])
  const serverRowsByIndex = useMemo(() => {
    return new Map(serverPreview?.rows.map((row) => [row.index, row]) ?? [])
  }, [serverPreview])
  const rows = useMemo(() => {
    return localRows.map((row) => {
      const serverRow = serverRowsByIndex.get(row.index)
      if (!serverRow) return row
      return {
        ...row,
        errors: serverRow.errors,
        action: serverRow.action === "invalid" ? row.action : serverRow.action,
        existingId: serverRow.existingId,
        existingName: serverRow.existingName,
      }
    })
  }, [localRows, serverRowsByIndex])
  const cities = useMemo(() => {
    const cityNames = parsed.venues.map((v) => v.city).filter((city): city is string => Boolean(city))
    return ["All", ...Array.from(new Set(cityNames))]
  }, [parsed.venues])
  const createCount = rows.filter((row) => row.action === "create").length
  const updateCount = rows.filter((row) => row.action === "update").length
  const invalidCount = rows.filter((row) => row.errors.length > 0).length
  const previewMode = serverPreview ? "DB preview" : "Local validation"

  async function runServerPreview() {
    setServerError("")
    setServerPreview(null)
    if (parsed.error) {
      setServerError(parsed.error)
      return
    }
    setIsPreviewing(true)
    try {
      const response = await fetch("/api/venue-imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues: parsed.venues, city: cityFilter }),
      })
      const result = (await response.json()) as ServerPreview | { error?: string }
      if (!response.ok || !isServerPreview(result)) {
        throw new Error("error" in result && result.error ? result.error : "Preview failed")
      }
      setServerPreview(result)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Preview failed")
    } finally {
      setIsPreviewing(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1115]">Venue imports</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Preview Google Places JSON before running the server-side importer.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runServerPreview}
            disabled={isPreviewing || Boolean(parsed.error)}
            className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPreviewing ? "Checking DB..." : "Preview from DB"}
          </button>
          <button
            onClick={() => {
              setJson(SAMPLE)
              setServerPreview(null)
              setServerError("")
            }}
            className="px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB]"
          >
            Load sample
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F1115]">Import JSON</h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Paste output from <code className="text-[#0F1115]">pnpm db:fetch:google-venues</code>.
              </p>
            </div>
            <select
              value={cityFilter}
              onChange={(event) => {
                setCityFilter(event.target.value)
                setServerPreview(null)
                setServerError("")
              }}
              className="px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm"
            >
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <textarea
            value={json}
            onChange={(event) => {
              setJson(event.target.value)
              setServerPreview(null)
              setServerError("")
            }}
            spellCheck={false}
            className="w-full min-h-[520px] font-mono text-xs leading-5 px-3 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
          />
          {parsed.error ? (
            <p className="mt-3 text-sm text-red-600">{parsed.error}</p>
          ) : (
            <p className="mt-3 text-sm text-[#6B7280]">
              {previewMode}: {rows.length} venues · {createCount} create · {updateCount} update · {invalidCount} invalid
            </p>
          )}
          {serverError ? <p className="mt-2 text-sm text-red-600">{serverError}</p> : null}
        </section>

        <aside className="space-y-6">
          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#0F1115] mb-4">Runbook</h2>
            <Command label="Fetch Belgrade" value={'GOOGLE_PLACES_API_KEY=... pnpm db:fetch:google-venues -- --query="coffee Belgrade" --city=Belgrade'} />
            <Command label="Dry run" value="pnpm db:import:venues -- --file=src/data/google-belgrade.json --json" />
            <Command label="Apply after review" value="pnpm db:import:venues -- --file=src/data/google-belgrade.json --apply" />
          </section>

          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#0F1115] mb-4">Preview</h2>
            {parsed.error ? (
              <p className="text-sm text-[#9CA3AF]">Fix JSON to preview rows.</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No venues match this filter.</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {rows.map(({ venue, index, errors, action, existingId, existingName }) => (
                  <div key={`${venue.sourceProvider}-${venue.sourcePlaceId}-${index}`} className="border border-[#E5E7EB] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-[#0F1115]">{venue.name ?? "Untitled venue"}</p>
                        <p className="text-xs text-[#6B7280] mt-1">{venue.category ?? "—"} · {venue.city ?? "—"}</p>
                        {existingId ? (
                          <p className="text-xs text-[#2563EB] mt-1">
                            Matches {existingName ?? "venue"} · {existingId}
                          </p>
                        ) : null}
                      </div>
                      <span className={action === "update" ? "rounded-full bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]" : "rounded-full bg-[#ECFDF5] px-2 py-1 text-xs font-semibold text-[#059669]"}>
                        {action}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-2">{venue.address}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {venue.googleRating ? <Badge>Google {venue.googleRating} · {venue.googleReviews ?? 0}</Badge> : null}
                      {venue.website ? <Badge>site</Badge> : null}
                      {venue.instagram ? <Badge>Instagram</Badge> : null}
                      {venue.specialOffers?.length ? <Badge>{venue.specialOffers.length} offers</Badge> : null}
                    </div>
                    {errors.length > 0 ? (
                      <ul className="mt-3 list-disc pl-4 text-xs text-red-600 space-y-1">
                        {errors.map((error) => <li key={error}>{error}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Command({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">{label}</p>
      <code className="block rounded-lg bg-[#F3F4F6] px-3 py-2 text-xs text-[#0F1115] leading-5 break-words">
        {value}
      </code>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-1 text-[#6B7280]">
      {children}
    </span>
  )
}
