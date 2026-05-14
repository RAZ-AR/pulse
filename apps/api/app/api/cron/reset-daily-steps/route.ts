import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

async function run() {
  const result = await db.user.updateMany({
    where: { stepsToday: { gt: 0 } },
    data: { stepsToday: 0 },
  })
  return { resetCount: result.count }
}

// Runs daily at 00:05 UTC — resets stepsToday for all users
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
