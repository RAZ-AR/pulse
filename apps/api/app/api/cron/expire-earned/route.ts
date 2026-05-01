import { expireEarnedPoints } from "@pulse/jobs/handlers/expire-earned-points"
import { verifyQStashSignature } from "../_verify"

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err

  const result = await expireEarnedPoints()
  return Response.json(result)
}
