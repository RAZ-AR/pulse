import { expireEarnedPoints } from "@pulse/jobs"
import { verifyQStashSignature, verifyCronSecret } from "../_verify"

export async function GET(req: Request) {
  const err = verifyCronSecret(req)
  if (err) return err
  return Response.json(await expireEarnedPoints())
}

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err
  return Response.json(await expireEarnedPoints())
}
