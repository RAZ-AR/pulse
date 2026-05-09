import type { Prisma, PrismaClient, SubscriptionTier, VenueCategory } from "@pulse/db"

export type ImportVenue = {
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

export type NormalizedImportVenue = {
  sourceProvider: string
  sourcePlaceId: string
  existingVenueId?: string
  sourceUrl?: string
  name: string
  category: VenueCategory
  description?: string
  address: string
  city: string
  country: string
  lat: number
  lng: number
  phone?: string
  website?: string
  instagram?: string
  openingHoursText?: string
  googleRating?: number
  googleReviews?: number
  specialOffers?: string[]
  isPartner: boolean
  pointsPerCurrency?: number
  currency?: string
  enableDiscount: boolean
  maxDiscountPercent: number
  subscriptionTier?: SubscriptionTier
}

export type ImportPreviewRow = {
  index: number
  action: "create" | "update" | "invalid"
  existingId: string | null
  existingName: string | null
  errors: string[]
}

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

const VALID_CATEGORIES: VenueCategory[] = ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]
const VALID_TIERS: SubscriptionTier[] = ["BASIC", "PRO", "FEATURED"]

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export function validationErrors(venue: ImportVenue) {
  const errors: string[] = []
  for (const field of REQUIRED) {
    const value = venue[field]
    if (value === undefined || value === null || value === "") errors.push(`${field} is required`)
  }
  if (!VALID_CATEGORIES.includes(String(venue.category) as VenueCategory)) errors.push("category is invalid")
  if (typeof venue.lat !== "number" || venue.lat < -90 || venue.lat > 90) errors.push("lat must be a valid latitude")
  if (typeof venue.lng !== "number" || venue.lng < -180 || venue.lng > 180) errors.push("lng must be a valid longitude")
  if (venue.googleRating !== undefined && (venue.googleRating < 0 || venue.googleRating > 5)) {
    errors.push("googleRating must be 0-5")
  }
  if (venue.subscriptionTier && !VALID_TIERS.includes(venue.subscriptionTier as SubscriptionTier)) {
    errors.push("subscriptionTier is invalid")
  }
  return errors
}

export function normalizeImportVenue(venue: ImportVenue): NormalizedImportVenue {
  const errors = validationErrors(venue)
  if (errors.length > 0) throw new Error(errors.join("; "))

  const specialOffers = Array.isArray(venue.specialOffers)
    ? venue.specialOffers.filter((offer): offer is string => typeof offer === "string" && offer.trim().length > 0)
    : undefined
  const existingVenueId = optionalString(venue.existingVenueId)
  const sourceUrl = optionalString(venue.sourceUrl)
  const description = optionalString(venue.description)
  const phone = optionalString(venue.phone)
  const website = optionalString(venue.website)
  const instagram = optionalString(venue.instagram)
  const openingHoursText = optionalString(venue.openingHoursText)
  const currency = optionalString(venue.currency)
  const subscriptionTier = optionalString(venue.subscriptionTier) as SubscriptionTier | undefined

  return {
    sourceProvider: venue.sourceProvider as string,
    sourcePlaceId: venue.sourcePlaceId as string,
    ...(existingVenueId ? { existingVenueId } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    name: venue.name as string,
    category: venue.category as VenueCategory,
    ...(description ? { description } : {}),
    address: venue.address as string,
    city: venue.city as string,
    country: optionalString(venue.country) ?? "Serbia",
    lat: venue.lat as number,
    lng: venue.lng as number,
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(instagram ? { instagram } : {}),
    ...(openingHoursText ? { openingHoursText } : {}),
    ...(typeof venue.googleRating === "number" ? { googleRating: venue.googleRating } : {}),
    ...(typeof venue.googleReviews === "number" ? { googleReviews: Math.round(venue.googleReviews) } : {}),
    ...(specialOffers ? { specialOffers } : {}),
    isPartner: typeof venue.isPartner === "boolean" ? venue.isPartner : false,
    ...(typeof venue.pointsPerCurrency === "number" ? { pointsPerCurrency: venue.pointsPerCurrency } : {}),
    ...(currency ? { currency } : {}),
    enableDiscount: typeof venue.enableDiscount === "boolean" ? venue.enableDiscount : false,
    maxDiscountPercent: typeof venue.maxDiscountPercent === "number" ? Math.round(venue.maxDiscountPercent) : 0,
    ...(subscriptionTier ? { subscriptionTier } : {}),
  }
}

export async function findExistingVenue(db: PrismaClient, venue: NormalizedImportVenue) {
  return db.venue.findFirst({
    where: {
      OR: [
        {
          sourceProvider: venue.sourceProvider,
          sourcePlaceId: venue.sourcePlaceId,
        },
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
}

export function toVenueData(venue: NormalizedImportVenue) {
  return {
    name: venue.name,
    category: venue.category,
    description: venue.description ?? null,
    address: venue.address,
    city: venue.city,
    country: venue.country,
    lat: venue.lat,
    lng: venue.lng,
    photos: [],
    isPartner: venue.isPartner,
    enableRewards: true,
    enableDiscount: venue.enableDiscount,
    maxDiscountPercent: venue.maxDiscountPercent,
    sourceProvider: venue.sourceProvider,
    sourcePlaceId: venue.sourcePlaceId,
    sourceUpdatedAt: new Date(),
    ...(venue.sourceUrl ? { sourceUrl: venue.sourceUrl } : {}),
    ...(typeof venue.pointsPerCurrency === "number" ? { pointsPerCurrency: venue.pointsPerCurrency } : {}),
    ...(venue.currency || typeof venue.pointsPerCurrency === "number" ? { currency: venue.currency ?? "RSD" } : {}),
    ...(venue.subscriptionTier ? { subscriptionTier: venue.subscriptionTier } : {}),
    ...(typeof venue.googleRating === "number" ? { googleRating: venue.googleRating } : {}),
    ...(typeof venue.googleReviews === "number" ? { googleReviews: venue.googleReviews } : {}),
    ...(venue.phone ? { phone: venue.phone } : {}),
    ...(venue.website ? { website: venue.website } : {}),
    ...(venue.instagram ? { instagram: venue.instagram } : {}),
    ...(venue.openingHoursText ? { openingHoursText: venue.openingHoursText } : {}),
    ...(venue.specialOffers ? { specialOffers: venue.specialOffers as Prisma.InputJsonValue } : {}),
  } satisfies Prisma.VenueCreateInput
}

export async function previewVenueImports(db: PrismaClient, venues: ImportVenue[], cityFilter?: string) {
  const rows: ImportPreviewRow[] = []
  const sourceCounts = new Map<string, number>()
  for (const venue of venues) {
    if (cityFilter && venue.city !== cityFilter) continue
    if (!venue.sourceProvider || !venue.sourcePlaceId) continue
    const key = `${venue.sourceProvider}:${venue.sourcePlaceId}`
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1)
  }

  for (const [index, venue] of venues.entries()) {
    if (cityFilter && venue.city !== cityFilter) continue

    const errors = validationErrors(venue)
    const sourceKey = venue.sourceProvider && venue.sourcePlaceId ? `${venue.sourceProvider}:${venue.sourcePlaceId}` : ""
    if (sourceKey && (sourceCounts.get(sourceKey) ?? 0) > 1) {
      errors.push("duplicate sourcePlaceId in JSON")
    }
    if (errors.length > 0) {
      rows.push({ index, action: "invalid", existingId: null, existingName: null, errors })
      continue
    }

    const normalized = normalizeImportVenue(venue)
    const existing = await findExistingVenue(db, normalized)
    rows.push({
      index,
      action: existing ? "update" : "create",
      existingId: existing?.id ?? null,
      existingName: existing?.name ?? null,
      errors,
    })
  }

  return rows
}

export function summarizeImportRows(rows: ImportPreviewRow[]) {
  return {
    total: rows.length,
    create: rows.filter((row) => row.action === "create").length,
    update: rows.filter((row) => row.action === "update").length,
    invalid: rows.filter((row) => row.action === "invalid").length,
  }
}
