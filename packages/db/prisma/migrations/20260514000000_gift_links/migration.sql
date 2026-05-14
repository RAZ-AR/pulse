-- CreateTable
CREATE TABLE "GiftLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftLink_token_key" ON "GiftLink"("token");

-- CreateIndex
CREATE INDEX "GiftLink_token_idx" ON "GiftLink"("token");

-- CreateIndex
CREATE INDEX "GiftLink_senderId_idx" ON "GiftLink"("senderId");

-- AddForeignKey
ALTER TABLE "GiftLink" ADD CONSTRAINT "GiftLink_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftLink" ADD CONSTRAINT "GiftLink_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
