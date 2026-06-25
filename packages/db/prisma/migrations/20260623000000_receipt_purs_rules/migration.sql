ALTER TABLE "Transaction"
  ADD COLUMN "receiptDay" TEXT;

ALTER TABLE "Merchant"
  ADD COLUMN "taxIdNormalized" TEXT;

UPDATE "Merchant"
SET "taxIdNormalized" = regexp_replace("taxId", '[^0-9]', '', 'g')
WHERE "taxId" IS NOT NULL
  AND length(regexp_replace("taxId", '[^0-9]', '', 'g')) = 9;

CREATE INDEX "Merchant_taxIdNormalized_idx" ON "Merchant"("taxIdNormalized");

CREATE UNIQUE INDEX "Transaction_userId_receiptDay_key"
  ON "Transaction"("userId", "receiptDay");

CREATE TABLE "ReceiptIssuer" (
  "id" TEXT NOT NULL,
  "taxId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "lastLocationName" TEXT,
  "category" "VenueCategory",
  "activityCode" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptIssuer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReceiptIssuer_taxId_key" ON "ReceiptIssuer"("taxId");
CREATE INDEX "ReceiptIssuer_category_idx" ON "ReceiptIssuer"("category");

-- Partner receipts must never earn less than the platform-funded 1% baseline.
UPDATE "Venue"
SET "pointsPerCurrency" = 0.01
WHERE "isPartner" = TRUE
  AND "ownerId" IS NOT NULL
  AND ("pointsPerCurrency" IS NULL OR "pointsPerCurrency" < 0.01);
