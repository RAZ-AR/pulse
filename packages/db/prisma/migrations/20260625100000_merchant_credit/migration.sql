-- Кредит баллами для мерчанта (овердрафт с согласием и сроком)
ALTER TABLE "Merchant" ADD COLUMN "creditLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ADD COLUMN "creditDueAt" TIMESTAMP(3);
ALTER TABLE "Merchant" ADD COLUMN "creditAcceptedAt" TIMESTAMP(3);
