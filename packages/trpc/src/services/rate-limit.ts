import { createHash } from "node:crypto"
import { Redis } from "@upstash/redis"
import { TRPCError } from "@trpc/server"
import { RECEIPT_DAILY_LIMIT, RECEIPT_HOURLY_LIMIT } from "@pulse/shared"

let _redis: Redis | null = null

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
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

/**
 * Checks whether this image URL has already been scanned (fingerprint dedup).
 * Stores the URL hash in Redis with a 30-day TTL on first encounter.
 * Returns true if this is a duplicate (same URL seen before for any user).
 */
export async function checkImageFingerprint(imageUrl: string): Promise<boolean> {
  const r = getRedis()
  if (!r) return false

  const urlHash = createHash("sha256").update(imageUrl).digest("hex")
  const key = `img:${urlHash}`

  // SETNX: set only if not exists, returns 1 on first set (new), 0 if already exists (dup)
  const result = await r.set(key, "1", { nx: true, ex: 30 * 86400 })
  return result === null // null = key existed → duplicate
}

/**
 * Per-user per-vendor daily velocity: max 2 receipts from the same vendor per user per day.
 * Catches repeated submission of receipts from the same café even with altered image uploads.
 */
export async function checkVendorVelocity(userId: string, vendor: string): Promise<void> {
  const r = getRedis()
  if (!r) return

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const normalized = vendor.toLowerCase().replace(/\s+/g, "").slice(0, 40)
  const key = `rl:vendor:${userId}:${normalized}:${today}`

  const count = await increment(key, 86400)
  if (count > 2) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many receipts from the same vendor today",
    })
  }
}
