import { expireWelcomePoints } from "@pulse/jobs/handlers/expire-welcome-points"

// Called by Upstash QStash daily at 03:00 UTC
export async function POST(req: Request) {
  const sig = req.headers.get("upstash-signature")
  if (!sig && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 })
  }

  const result = await expireWelcomePoints()
  return Response.json(result)
}
