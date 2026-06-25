-- Offer: цвет карточки и срок сгорания начисляемых баллов
ALTER TABLE "Offer" ADD COLUMN "cardColor" TEXT;
ALTER TABLE "Offer" ADD COLUMN "pointsExpireDays" INTEGER;

-- Партии начисленных баллов со сроком сгорания
CREATE TABLE "PointsExpiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "burnedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'OFFER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsExpiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointsExpiry_burnedAt_expiresAt_idx" ON "PointsExpiry"("burnedAt", "expiresAt");
CREATE INDEX "PointsExpiry_userId_idx" ON "PointsExpiry"("userId");

ALTER TABLE "PointsExpiry" ADD CONSTRAINT "PointsExpiry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
