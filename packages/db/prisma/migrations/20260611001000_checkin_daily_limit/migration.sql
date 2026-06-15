ALTER TABLE "Checkin" ADD COLUMN "checkinDay" TEXT;

CREATE UNIQUE INDEX "Checkin_userId_checkinDay_key" ON "Checkin"("userId", "checkinDay");
