-- Store public-source metadata and contact fields imported for venues.
ALTER TABLE "Venue"
ADD COLUMN "sourceProvider" TEXT,
ADD COLUMN "sourcePlaceId" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN "phone" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "instagram" TEXT,
ADD COLUMN "openingHoursText" TEXT,
ADD COLUMN "specialOffers" JSONB;

CREATE UNIQUE INDEX "Venue_sourceProvider_sourcePlaceId_key" ON "Venue"("sourceProvider", "sourcePlaceId");
