-- Add logo URL to Merchant
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

-- Add social links to Venue
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "tiktok" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "telegram" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT;
