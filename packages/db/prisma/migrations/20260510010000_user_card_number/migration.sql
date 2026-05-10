-- Add universal loyalty card number (5-digit, unique per user)
ALTER TABLE "User" ADD COLUMN "cardNumber" TEXT;
CREATE UNIQUE INDEX "User_cardNumber_key" ON "User"("cardNumber");
