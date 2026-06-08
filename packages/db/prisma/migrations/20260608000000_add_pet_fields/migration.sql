-- Pet (tamagotchi): persist only name + highest acknowledged stage.
-- Stage and hunger are derived from points/streak at read time.
ALTER TABLE "User" ADD COLUMN "petName" TEXT;
ALTER TABLE "User" ADD COLUMN "petStageSeen" INTEGER NOT NULL DEFAULT 0;
