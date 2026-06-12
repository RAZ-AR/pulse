import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"
import { enrichVenueFromGoogle } from "@pulse/trpc"

const db = new PrismaClient()

export const maxDuration = 300

const TTL_DAYS = 30
const BATCH = 60

// Daily: proactively refresh Google data for the venues that matter (partners
// or venues with reviews) whose enrichment is stale — so they stay fresh even
// without a user opening them. Lazy on-view enrichment covers the rest.
// No-ops gracefully while the Google key has no billing.
async function run() {
  const ttlDate = new Date(Date.now() - TTL_DAYS * 86_400_000)
  const venues = await db.venue.findMany({
    where: {
      AND: [
        { OR: [{ lastEnrichedAt: null }, { lastEnrichedAt: { lt: ttlDate } }] },
        { OR: [{ isPartner: true }, { reviews: { some: {} } }] },
      ],
    },
    orderBy: [{ isPartner: "desc" }, { lastEnrichedAt: { sort: "asc", nulls: "first" } }],
    take: BATCH,
    select: { id: true, name: true, city: true, lat: true, lng: true, phone: true, website: true, lastEnrichedAt: true },
  })

  let enriched = 0
  for (const v of venues) {
    if (await enrichVenueFromGoogle(db, v)) enriched++
  }
  return { ok: true, considered: venues.length, enriched }
}

export async function GET(req: Request) {
  const err = verifyCronSecret(req)
  if (err) return err
  return Response.json(await run())
}

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err
  return Response.json(await run())
}
