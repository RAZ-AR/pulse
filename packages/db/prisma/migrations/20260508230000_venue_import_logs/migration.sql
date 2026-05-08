-- CreateTable
CREATE TABLE "VenueImportLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "city" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google_maps',
    "total" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "invalid" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueImportLog_merchantId_createdAt_idx" ON "VenueImportLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "VenueImportLog_city_idx" ON "VenueImportLog"("city");

-- AddForeignKey
ALTER TABLE "VenueImportLog" ADD CONSTRAINT "VenueImportLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
