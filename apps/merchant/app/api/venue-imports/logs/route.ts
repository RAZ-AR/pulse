import { db } from "@pulse/db"
import { merchantAuth } from "@pulse/auth/merchant"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await merchantAuth()
  const merchantId = (session as { merchant?: { id: string } } | null)?.merchant?.id
  if (!merchantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const logs = await db.venueImportLog.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      city: true,
      source: true,
      total: true,
      created: true,
      updated: true,
      invalid: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  })
}
