import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"
import { importAllCities } from "../../../../src/lib/osm-import"

const db = new PrismaClient()

// Weekly OSM resync for Belgrade + Novi Sad. Upserts cafes/restaurants/shops/
// beauty/fitness/yoga into Venue. Long-running — give it room.
export const maxDuration = 300

async function run() {
  const started = Date.now()
  const cities = await importAllCities(db)
  const totals = cities.reduce(
    (a, c) => ({
      fetched: a.fetched + c.fetched,
      created: a.created + c.created,
      linked: a.linked + c.linked,
      updated: a.updated + c.updated,
      skipped: a.skipped + c.skipped,
    }),
    { fetched: 0, created: 0, linked: 0, updated: 0, skipped: 0 },
  )
  return { ok: true, ms: Date.now() - started, totals, cities }
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
