import { generateWeeklyChallenges } from "@pulse/jobs"
import { verifyQStashSignature } from "../_verify"

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err

  const result = await generateWeeklyChallenges()
  return Response.json(result)
}
