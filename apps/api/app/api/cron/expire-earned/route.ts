import { expireEarnedPoints } from "@pulse/jobs/handlers/expire-earned-points"

// Called by Upstash QStash monthly at 04:00 UTC on the 1st
export async function POST(req: Request) {
  const sig = req.headers.get("upstash-signature")
  if (!sig && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 })
  }

  const result = await expireEarnedPoints()
  return Response.json(result)
}
