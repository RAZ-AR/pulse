import { config } from "dotenv"
import { resolve } from "node:path"
config({ path: resolve(__dirname, "../../../.env") })
import { PrismaClient } from "@pulse/db"
import { importAllCities } from "../src/lib/osm-import"

const db = new PrismaClient()
;(async () => {
  const before = await db.venue.count()
  console.log("venues before:", before)
  const res = await importAllCities(db)
  console.log(JSON.stringify(res, null, 2))
  const after = await db.venue.count()
  const byCat = await db.venue.groupBy({ by: ["category"], _count: true })
  console.log("venues after:", after)
  console.log("by category:", byCat.map((c) => `${c.category}:${c._count}`).join(" · "))
  await db.$disconnect()
})().catch((e) => { console.error("ERR", e); process.exit(1) })
