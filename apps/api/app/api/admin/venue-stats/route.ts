import { verifyCronSecret } from "../../cron/_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

// Lightweight import/freshness dashboard (JSON). Guarded by CRON_SECRET.
// GET /api/admin/venue-stats  (Authorization: Bearer <CRON_SECRET>)
async function run() {
  const [total, partners, enriched, withRating, withReviews, byCategory, byCity, bySource, lastImport] = await Promise.all([
    db.venue.count(),
    db.venue.count({ where: { isPartner: true } }),
    db.venue.count({ where: { lastEnrichedAt: { not: null } } }),
    db.venue.count({ where: { googleRating: { not: null } } }),
    db.venue.count({ where: { reviews: { some: {} } } }),
    db.venue.groupBy({ by: ["category"], _count: true }),
    db.venue.groupBy({ by: ["city"], _count: true }),
    db.venue.groupBy({ by: ["sourceProvider"], _count: true }),
    db.venueImportLog.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
  ])

  return {
    total,
    partners,
    enriched,
    withGoogleRating: withRating,
    withReviews,
    byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
    byCity: Object.fromEntries(byCity.map((c) => [c.city, c._count])),
    bySource: Object.fromEntries(bySource.map((c) => [c.sourceProvider ?? "manual", c._count])),
    lastImport,
  }
}

export async function GET(req: Request) {
  const err = verifyCronSecret(req)
  if (err) return err
  return Response.json(await run())
}
