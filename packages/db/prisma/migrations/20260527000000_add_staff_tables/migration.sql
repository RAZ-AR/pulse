-- CreateTable: StaffInvite
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StaffMember
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "name" TEXT,
    "venueId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvite_token_key" ON "StaffInvite"("token");
CREATE INDEX "StaffInvite_token_idx" ON "StaffInvite"("token");
CREATE INDEX "StaffInvite_venueId_idx" ON "StaffInvite"("venueId");

CREATE UNIQUE INDEX "StaffMember_telegramChatId_key" ON "StaffMember"("telegramChatId");
CREATE INDEX "StaffMember_venueId_idx" ON "StaffMember"("venueId");
CREATE INDEX "StaffMember_merchantId_idx" ON "StaffMember"("merchantId");

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
