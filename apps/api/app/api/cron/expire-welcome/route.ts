import { expireWelcomePoints } from "@pulse/jobs"
import { verifyQStashSignature, verifyCronSecret } from "../_verify"

export async function GET(req: Request) {
  const err = verifyCronSecret(req)
  if (err) return err
  return Response.json(await expireWelcomePoints())
}

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err
  return Response.json(await expireWelcomePoints())
}
