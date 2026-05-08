import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { db } from "./client"
import type { Prisma, SubscriptionTier, VenueCategory } from "../generated"

const VALID_CATEGORIES: VenueCategory[] = ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]
const VALID_TIERS: SubscriptionTier[] = ["BASIC", "PRO", "FEATURED"]

type ImportVenue = {
  sourceProvider: string
  sourcePlaceId: string
  existingVenueId?: string
  sourceUrl?: string
  name: string
  category: VenueCategory
  description?: string
  address: string
  city: string
  country?: string
  lat: number
  lng: number
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
  subscriptionTier?: SubscriptionTier
}

function parseArgs() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const json = args.includes("--json")
  const fileFlag = args.find((arg) => arg.startsWith("--file="))
  const cityFlag = args.find((arg) => arg.startsWith("--city="))
  return {
    apply,
    json,
    file: resolve(process.cwd(), fileFlag?.slice("--file=".length) ?? "src/data/public-venues.sample.json"),
    city: cityFlag?.slice("--city=".length),
  }
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required`)
  return value.trim()
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a number`)
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function normalizeVenue(raw: unknown, index: number): ImportVenue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`row ${index + 1} must be an object`)
  const row = raw as Record<string, unknown>
  const category = asString(row.category, `row ${index + 1}.category`) as VenueCategory
  if (!VALID_CATEGORIES.includes(category)) throw new Error(`row ${index + 1}.category is invalid`)
  const subscriptionTier = optionalString(row.subscriptionTier) as SubscriptionTier | undefined
  if (subscriptionTier && !VALID_TIERS.includes(subscriptionTier)) throw new Error(`row ${index + 1}.subscriptionTier is invalid`)

  const specialOffers = Array.isArray(row.specialOffers)
    ? row.specialOffers.filter((offer): offer is string => typeof offer === "string" && offer.trim().length > 0)
    : undefined

  return {
    sourceProvider: asString(row.sourceProvider, `row ${index + 1}.sourceProvider`),
    sourcePlaceId: asString(row.sourcePlaceId, `row ${index + 1}.sourcePlaceId`),
    existingVenueId: optionalString(row.existingVenueId),
    sourceUrl: optionalString(row.sourceUrl),
    name: asString(row.name, `row ${index + 1}.name`),
    category,
    description: optionalString(row.description),
    address: asString(row.address, `row ${index + 1}.address`),
    city: asString(row.city, `row ${index + 1}.city`),
    country: optionalString(row.country) ?? "Serbia",
    lat: asNumber(row.lat, `row ${index + 1}.lat`),
    lng: asNumber(row.lng, `row ${index + 1}.lng`),
    phone: optionalString(row.phone),
    website: optionalString(row.website),
    instagram: optionalString(row.instagram),
    openingHoursText: optionalString(row.openingHoursText),
    googleRating: typeof row.googleRating === "number" ? row.googleRating : undefined,
    googleReviews: typeof row.googleReviews === "number" ? Math.round(row.googleReviews) : undefined,
    specialOffers,
    isPartner: typeof row.isPartner === "boolean" ? row.isPartner : false,
    pointsPerCurrency: typeof row.pointsPerCurrency === "number" ? row.pointsPerCurrency : undefined,
    currency: optionalString(row.currency),
    enableDiscount: typeof row.enableDiscount === "boolean" ? row.enableDiscount : false,
    maxDiscountPercent: typeof row.maxDiscountPercent === "number" ? Math.round(row.maxDiscountPercent) : 0,
    subscriptionTier,
  }
}

function toVenueData(venue: ImportVenue): Prisma.VenueCreateInput {
  return {
    name: venue.name,
    category: venue.category,
    description: venue.description ?? null,
    address: venue.address,
    city: venue.city,
    country: venue.country ?? "Serbia",
    lat: venue.lat,
    lng: venue.lng,
    photos: [],
    isPartner: venue.isPartner ?? false,
    pointsPerCurrency: venue.pointsPerCurrency,
    currency: venue.currency ?? (venue.pointsPerCurrency ? "RSD" : undefined),
    enableRewards: true,
    enableDiscount: venue.enableDiscount ?? false,
    maxDiscountPercent: venue.maxDiscountPercent ?? 0,
    subscriptionTier: venue.subscriptionTier,
    googleRating: venue.googleRating,
    googleReviews: venue.googleReviews,
    sourceProvider: venue.sourceProvider,
    sourcePlaceId: venue.sourcePlaceId,
    sourceUrl: venue.sourceUrl,
    sourceUpdatedAt: new Date(),
    phone: venue.phone,
    website: venue.website,
    instagram: venue.instagram,
    openingHoursText: venue.openingHoursText,
    specialOffers: venue.specialOffers as Prisma.InputJsonValue | undefined,
  }
}

async function main() {
  const { apply, json, file, city } = parseArgs()
  const raw = JSON.parse(await readFile(file, "utf8")) as unknown
  if (!Array.isArray(raw)) throw new Error("import file must be a JSON array")

  const venues = raw
    .map(normalizeVenue)
    .filter((venue) => !city || venue.city.toLowerCase() === city.toLowerCase())

  const summary: {
    mode: "apply" | "preview"
    file: string
    city?: string
    total: number
    create: number
    update: number
    items: {
      action: "create" | "update"
      city: string
      name: string
      sourceProvider: string
      sourcePlaceId: string
      existingId: string | null
    }[]
  } = {
    mode: apply ? "apply" : "preview",
    file,
    ...(city ? { city } : {}),
    total: venues.length,
    create: 0,
    update: 0,
    items: [],
  }

  if (!json) {
    console.log(`${apply ? "Applying" : "Previewing"} ${venues.length} venue imports from ${file}`)
    if (city) console.log(`City filter: ${city}`)
  }

  for (const venue of venues) {
    const data = toVenueData(venue)
    const existing = await db.venue.findFirst({
      where: {
        OR: [
          { sourceProvider: venue.sourceProvider, sourcePlaceId: venue.sourcePlaceId },
          ...(venue.existingVenueId ? [{ id: venue.existingVenueId }] : []),
          {
            name: { equals: venue.name, mode: "insensitive" },
            city: { equals: venue.city, mode: "insensitive" },
            address: { equals: venue.address, mode: "insensitive" },
          },
        ],
      },
      select: { id: true, name: true },
    })

    const action = existing ? "update" : "create"
    summary[action] += 1
    summary.items.push({
      action,
      city: venue.city,
      name: venue.name,
      sourceProvider: venue.sourceProvider,
      sourcePlaceId: venue.sourcePlaceId,
      existingId: existing?.id ?? null,
    })
    if (!json) console.log(`${action.toUpperCase()} ${venue.city}: ${venue.name} (${venue.sourceProvider}:${venue.sourcePlaceId})`)

    if (!apply) continue

    if (existing) {
      await db.venue.update({ where: { id: existing.id }, data })
    } else {
      await db.venue.create({ data })
    }
  }

  if (json) {
    console.log(JSON.stringify(summary, null, 2))
  } else if (!apply) {
    console.log("Dry run only. Re-run with --apply to write changes.")
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
