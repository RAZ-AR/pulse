-- Places discovery (P1): new categories, venue enrichment + osm fields, review extras

-- New venue categories (PG 12+ allows ADD VALUE outside an explicit tx block)
ALTER TYPE "VenueCategory" ADD VALUE IF NOT EXISTS 'BEAUTY';
ALTER TYPE "VenueCategory" ADD VALUE IF NOT EXISTS 'FITNESS';
ALTER TYPE "VenueCategory" ADD VALUE IF NOT EXISTS 'YOGA';

-- Venue: enrichment + OSM source fields
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "priceLevel" INTEGER;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "osmId" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Venue_osmId_key" ON "Venue"("osmId");

-- Review: photos, helpful votes, one-time points flag, updatedAt
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "pointsAwarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
