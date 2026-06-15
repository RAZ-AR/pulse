ALTER TABLE "Transaction" ADD COLUMN "merchantRequestId" TEXT;

CREATE UNIQUE INDEX "Transaction_merchantRequestId_key" ON "Transaction"("merchantRequestId");
CREATE INDEX "Transaction_merchantRequestId_idx" ON "Transaction"("merchantRequestId");
