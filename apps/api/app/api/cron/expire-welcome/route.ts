import { expireWelcomePoints } from "@pulse/jobs/handlers/expire-welcome-points"
import { verifyQStashSignature } from "../_verify"

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err

  const result = await expireWelcomePoints()
  return Response.json(result)
}
