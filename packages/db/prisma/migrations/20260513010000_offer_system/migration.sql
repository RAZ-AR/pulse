-- MerchantStatus enum
CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- Extend Merchant
ALTER TABLE "Merchant"
  ADD COLUMN "address"        TEXT,
  ADD COLUMN "taxId"          TEXT,
  ADD COLUMN "telegramChatId" TEXT UNIQUE,
  ADD COLUMN "status"         "MerchantStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "pointsBalance"  INT NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Merchant" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Offer
CREATE TABLE "Offer" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "venueId"      TEXT        NOT NULL,
  "merchantId"   TEXT        NOT NULL,
  "title"        TEXT        NOT NULL,
  "description"  TEXT,
  "imageUrl"     TEXT,
  "pointsReward" INT         NOT NULL,
  "costPoints"   INT         NOT NULL,
  "startsAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endsAt"       TIMESTAMPTZ,
  "usageLimit"   INT,
  "usageCount"   INT         NOT NULL DEFAULT 0,
  "qrToken"      TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "active"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_venueId_fkey"   FOREIGN KEY ("venueId")   REFERENCES "Venue"("id");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id");
CREATE INDEX "Offer_venueId_active_idx" ON "Offer"("venueId", "active");
CREATE INDEX "Offer_qrToken_idx"        ON "Offer"("qrToken");

-- OfferRedemption
CREATE TABLE "OfferRedemption" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "offerId"      TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL,
  "pointsEarned" INT         NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OfferRedemption_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "OfferRedemption_offerId_userId_key" UNIQUE ("offerId", "userId")
);
ALTER TABLE "OfferRedemption" ADD CONSTRAINT "OfferRedemption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id");
ALTER TABLE "OfferRedemption" ADD CONSTRAINT "OfferRedemption_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id");
CREATE INDEX "OfferRedemption_userId_idx" ON "OfferRedemption"("userId");
