"use client"

import { useEffect, useMemo, useState } from "react"

type ImportVenue = {
  sourceProvider?: string
  sourcePlaceId?: string
  existingVenueId?: string
  sourceUrl?: string
  name?: string
  category?: string
  description?: string
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
  currency?: string
  enableDiscount?: boolean
  maxDiscountPercent?: number
  subscriptionTier?: string
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

type ImportLog = {
  id: string
  city: string | null
  source: string
  total: number
  created: number
  updated: number
  invalid: number
  createdAt: string
}

type GoogleFetchResult = {
  venues: ImportVenue[]
  summary: {
    total: number
    query: string
    city: string
    country: string
  }
}

type PreviewRow = {
  venue: ImportVenue
  index: number
  errors: string[]
  action: "create" | "update"
  isDuplicate?: boolean
  existingId?: string | null
  existingName?: string | null
}

type PreviewFilter = "all" | "create" | "update" | "invalid" | "duplicates"

const GOOGLE_PRESETS = [
  { label: "Belgrade cafes", query: "cafes Belgrade", city: "Belgrade" },
  { label: "Belgrade coffee", query: "coffee shop Belgrade", city: "Belgrade" },
  { label: "Belgrade restaurants", query: "restaurants Belgrade", city: "Belgrade" },
  { label: "Belgrade Japanese", query: "Japanese restaurant Belgrade", city: "Belgrade" },
  { label: "Belgrade bakeries", query: "bakery Belgrade", city: "Belgrade" },
  { label: "Belgrade bars", query: "bar Belgrade", city: "Belgrade" },
  { label: "Novi Sad cafes", query: "cafes Novi Sad", city: "Novi Sad" },
  { label: "Novi Sad coffee", query: "coffee shop Novi Sad", city: "Novi Sad" },
  { label: "Novi Sad restaurants", query: "restaurants Novi Sad", city: "Novi Sad" },
  { label: "Novi Sad Japanese", query: "Japanese restaurant Novi Sad", city: "Novi Sad" },
  { label: "Novi Sad bakeries", query: "bakery Novi Sad", city: "Novi Sad" },
  { label: "Novi Sad bars", query: "bar Novi Sad", city: "Novi Sad" },
] as const

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
  const [applyConfirmation, setApplyConfirmation] = useState("")
  const [applyMessage, setApplyMessage] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [fetchQuery, setFetchQuery] = useState("coffee Belgrade")
  const [fetchCity, setFetchCity] = useState("Belgrade")
  const [fetchCountry, setFetchCountry] = useState("Serbia")
  const [fetchLimit, setFetchLimit] = useState(10)
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false)
  const [fetchMessage, setFetchMessage] = useState("")
  const [previewSearch, setPreviewSearch] = useState("")
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all")
  const parsed = useMemo(() => parseImportJson(json), [json])
  const duplicateSourceIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const venue of parsed.venues) {
      if (!venue.sourceProvider || !venue.sourcePlaceId) continue
      const key = `${venue.sourceProvider}:${venue.sourcePlaceId}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key))
  }, [parsed.venues])
  const localRows = useMemo(() => {
    return parsed.venues
      .map((venue, index): PreviewRow => {
        const duplicateKey = venue.sourceProvider && venue.sourcePlaceId
          ? `${venue.sourceProvider}:${venue.sourcePlaceId}`
          : ""
        const isDuplicate = duplicateKey ? duplicateSourceIds.has(duplicateKey) : false
        return {
          venue,
          index,
          errors: isDuplicate ? [...validationErrors(venue), "duplicate sourcePlaceId in JSON"] : validationErrors(venue),
          action: venue.existingVenueId ? "update" : "create",
          isDuplicate,
        }
      })
      .filter((row) => cityFilter === "All" || row.venue.city === cityFilter)
  }, [cityFilter, duplicateSourceIds, parsed.venues])
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
  const duplicateCount = rows.filter((row) => row.isDuplicate).length
  const filteredRows = useMemo(() => {
    const needle = previewSearch.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesFilter =
        previewFilter === "all" ||
        (previewFilter === "invalid" && row.errors.length > 0) ||
        (previewFilter === "duplicates" && row.isDuplicate) ||
        (previewFilter === "create" && row.action === "create" && row.errors.length === 0) ||
        (previewFilter === "update" && row.action === "update" && row.errors.length === 0)
      if (!matchesFilter) return false
      if (!needle) return true
      return [
        row.venue.name,
        row.venue.address,
        row.venue.city,
        row.venue.category,
        row.venue.sourceProvider,
        row.venue.sourcePlaceId,
        row.existingId,
        row.existingName,
      ].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [previewFilter, previewSearch, rows])
  const previewMode = serverPreview ? "DB preview" : "Local validation"
  const canApply = Boolean(serverPreview) && invalidCount === 0 && rows.length > 0 && applyConfirmation === "APPLY"

  useEffect(() => {
    void loadImportLogs()
  }, [])

  async function loadImportLogs() {
    try {
      const response = await fetch("/api/venue-imports/logs")
      const result = (await response.json()) as { logs?: ImportLog[] }
      setLogs(Array.isArray(result.logs) ? result.logs : [])
    } catch {
      setLogs([])
    }
  }

  async function runServerPreview() {
    setServerError("")
    setServerPreview(null)
    setApplyMessage("")
    setApplyConfirmation("")
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

  async function fetchGooglePlaces() {
    setServerError("")
    setFetchMessage("")
    setApplyMessage("")
    setApplyConfirmation("")
    setIsFetchingGoogle(true)
    try {
      const response = await fetch("/api/venue-imports/fetch-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: fetchQuery,
          city: fetchCity,
          country: fetchCountry,
          limit: fetchLimit,
        }),
      })
      const result = (await response.json()) as GoogleFetchResult | { error?: string }
      if (!response.ok || !("venues" in result)) {
        throw new Error("error" in result && result.error ? result.error : "Google fetch failed")
      }
      setJson(JSON.stringify(result.venues, null, 2))
      setCityFilter(result.summary.city)
      setServerPreview(null)
      setFetchMessage(`Fetched ${result.summary.total} venues for ${result.summary.query}`)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Google fetch failed")
    } finally {
      setIsFetchingGoogle(false)
    }
  }

  function selectGooglePreset(preset: (typeof GOOGLE_PRESETS)[number]) {
    setFetchQuery(preset.query)
    setFetchCity(preset.city)
    setFetchCountry("Serbia")
    setFetchMessage("")
    setServerError("")
  }

  async function applyImport() {
    setServerError("")
    setApplyMessage("")
    if (!canApply) return
    setIsApplying(true)
    try {
      const response = await fetch("/api/venue-imports/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues: parsed.venues, city: cityFilter, confirmation: applyConfirmation }),
      })
      const result = (await response.json()) as ServerPreview | { error?: string }
      if (!response.ok || !isServerPreview(result)) {
        throw new Error("error" in result && result.error ? result.error : "Apply failed")
      }
      setServerPreview(result)
      setApplyMessage(`Applied ${result.summary.total} venues · ${result.summary.create} created · ${result.summary.update} updated`)
      setApplyConfirmation("")
      await loadImportLogs()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Apply failed")
    } finally {
      setIsApplying(false)
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
              setApplyMessage("")
              setApplyConfirmation("")
              setPreviewSearch("")
              setPreviewFilter("all")
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
                setApplyMessage("")
                setApplyConfirmation("")
                setPreviewFilter("all")
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
              setApplyMessage("")
              setApplyConfirmation("")
              setPreviewSearch("")
              setPreviewFilter("all")
            }}
            spellCheck={false}
            className="w-full min-h-[520px] font-mono text-xs leading-5 px-3 py-3 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
          />
          {parsed.error ? (
            <p className="mt-3 text-sm text-red-600">{parsed.error}</p>
          ) : (
            <p className="mt-3 text-sm text-[#6B7280]">
              {previewMode}: {rows.length} venues · {createCount} create · {updateCount} update · {invalidCount} invalid
              {duplicateCount > 0 ? ` · ${duplicateCount} duplicates` : ""}
            </p>
          )}
          {serverError ? <p className="mt-2 text-sm text-red-600">{serverError}</p> : null}
          {applyMessage ? <p className="mt-2 text-sm text-[#059669]">{applyMessage}</p> : null}
        </section>

        <aside className="space-y-6">
          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#0F1115] mb-2">Fetch from Google</h2>
            <p className="text-xs text-[#6B7280] mb-4">
              Uses the server-side Google Places key and fills the JSON preview.
            </p>
            <div className="mb-4">
              <p className="text-xs font-semibold text-[#6B7280] mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {GOOGLE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => selectGooglePreset(preset)}
                    className="rounded-full border border-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1">Query</label>
            <input
              value={fetchQuery}
              onChange={(event) => setFetchQuery(event.target.value)}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">City</label>
                <input
                  value={fetchCity}
                  onChange={(event) => setFetchCity(event.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">Country</label>
                <input
                  value={fetchCountry}
                  onChange={(event) => setFetchCountry(event.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm"
                />
              </div>
            </div>
            <label className="block text-xs font-semibold text-[#6B7280] mt-3 mb-1">Limit</label>
            <input
              type="number"
              min={1}
              max={20}
              value={fetchLimit}
              onChange={(event) => setFetchLimit(Number(event.target.value))}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm mb-3"
            />
            <button
              onClick={fetchGooglePlaces}
              disabled={isFetchingGoogle}
              className="w-full px-4 py-2 bg-[#0F1115] text-white text-sm font-semibold rounded-xl hover:bg-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingGoogle ? "Fetching..." : "Fetch Google venues"}
            </button>
            {fetchMessage ? <p className="mt-2 text-sm text-[#059669]">{fetchMessage}</p> : null}
          </section>

          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#0F1115] mb-4">Runbook</h2>
            <Command label="Fetch Belgrade" value={'GOOGLE_PLACES_API_KEY=... pnpm db:fetch:google-venues -- --query="coffee Belgrade" --city=Belgrade'} />
            <Command label="Dry run" value="pnpm db:import:venues -- --file=src/data/google-belgrade.json --json" />
            <Command label="Apply after review" value="pnpm db:import:venues -- --file=src/data/google-belgrade.json --apply" />
          </section>

          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-[#0F1115]">Import history</h2>
              <button
                onClick={loadImportLogs}
                className="px-3 py-1.5 border border-[#D1D5DB] text-[#374151] text-xs font-medium rounded-lg hover:bg-[#F9FAFB]"
              >
                Refresh
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No applied imports yet.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-[#E5E7EB] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0F1115]">{log.city ?? "All cities"}</p>
                        <p className="text-xs text-[#6B7280]">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-[#F9FAFB] px-2 py-1 text-xs font-medium text-[#6B7280]">
                        {log.source}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <Metric label="Total" value={log.total} />
                      <Metric label="New" value={log.created} />
                      <Metric label="Upd" value={log.updated} />
                      <Metric label="Bad" value={log.invalid} tone={log.invalid > 0 ? "danger" : "default"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#0F1115] mb-2">Apply import</h2>
            <p className="text-xs text-[#6B7280] mb-4">
              Run DB preview first. Type <code className="text-[#0F1115]">APPLY</code> to create or update these venues.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Metric label="Create" value={createCount} />
              <Metric label="Update" value={updateCount} />
              <Metric label="Invalid" value={invalidCount} tone={invalidCount > 0 ? "danger" : "default"} />
              <Metric label="Dupes" value={duplicateCount} tone={duplicateCount > 0 ? "danger" : "default"} />
            </div>
            <input
              value={applyConfirmation}
              onChange={(event) => setApplyConfirmation(event.target.value)}
              placeholder="Type APPLY"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm mb-3"
            />
            <button
              onClick={applyImport}
              disabled={!canApply || isApplying}
              className="w-full px-4 py-2 bg-[#EF4444] text-white text-sm font-semibold rounded-xl hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? "Applying..." : "Apply import"}
            </button>
          </section>

          <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-[#0F1115]">Preview</h2>
              <span className="text-xs text-[#6B7280]">{filteredRows.length} shown</span>
            </div>
            <input
              value={previewSearch}
              onChange={(event) => setPreviewSearch(event.target.value)}
              placeholder="Search name, address, source id"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm mb-3"
            />
            <div className="flex flex-wrap gap-2 mb-4">
              <FilterButton active={previewFilter === "all"} onClick={() => setPreviewFilter("all")}>All</FilterButton>
              <FilterButton active={previewFilter === "create"} onClick={() => setPreviewFilter("create")}>Create</FilterButton>
              <FilterButton active={previewFilter === "update"} onClick={() => setPreviewFilter("update")}>Update</FilterButton>
              <FilterButton active={previewFilter === "invalid"} onClick={() => setPreviewFilter("invalid")}>Invalid</FilterButton>
              <FilterButton active={previewFilter === "duplicates"} onClick={() => setPreviewFilter("duplicates")}>Dupes</FilterButton>
            </div>
            {parsed.error ? (
              <p className="text-sm text-[#9CA3AF]">Fix JSON to preview rows.</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No venues match this filter.</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No rows match the preview filters.</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {filteredRows.map(({ venue, index, errors, action, existingId, existingName, isDuplicate }) => (
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
                        {errors.length > 0 ? "invalid" : action}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-2">{venue.address}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge>#{index + 1}</Badge>
                      {venue.googleRating ? <Badge>Google {venue.googleRating} · {venue.googleReviews ?? 0}</Badge> : null}
                      {venue.website ? <Badge>site</Badge> : null}
                      {venue.instagram ? <Badge>Instagram</Badge> : null}
                      {venue.specialOffers?.length ? <Badge>{venue.specialOffers.length} offers</Badge> : null}
                      {isDuplicate ? <Badge>duplicate</Badge> : null}
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

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={active
        ? "rounded-full bg-[#0F1115] px-3 py-1.5 text-xs font-semibold text-white"
        : "rounded-full border border-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"}
    >
      {children}
    </button>
  )
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg bg-red-50 px-3 py-2" : "rounded-lg bg-[#F9FAFB] px-3 py-2"}>
      <p className={tone === "danger" ? "text-lg font-bold text-red-600" : "text-lg font-bold text-[#0F1115]"}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">{label}</p>
    </div>
  )
}
