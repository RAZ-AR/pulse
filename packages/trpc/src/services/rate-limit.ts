import { Redis } from "@upstash/redis"
import { TRPCError } from "@trpc/server"
import { RECEIPT_DAILY_LIMIT, RECEIPT_HOURLY_LIMIT } from "@pulse/shared"

let _redis: Redis | null = null

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // Redis not configured — skip in dev
  if (!_redis) _redis = new Redis({ url, token })
  return _redis
}

async function increment(key: string, windowSeconds: number): Promise<number> {
  const r = getRedis()
  if (!r) return 0

  const count = await r.incr(key)
  if (count === 1) await r.expire(key, windowSeconds)
  return count
}

export async function checkReceiptScanLimits(userId: string): Promise<void> {
  const [hourCount, dayCount] = await Promise.all([
    increment(`rl:receipt:h:${userId}`, 3600),
    increment(`rl:receipt:d:${userId}`, 86400),
  ])

  if (hourCount > RECEIPT_HOURLY_LIMIT) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Receipt scan limit: ${RECEIPT_HOURLY_LIMIT}/hour`,
    })
  }
  if (dayCount > RECEIPT_DAILY_LIMIT) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Receipt scan limit: ${RECEIPT_DAILY_LIMIT}/day`,
    })
  }
}
