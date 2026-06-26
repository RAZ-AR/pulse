-- ACTION_BONUS промо: бонус за действие (первый заказ / каждый N-й визит)
ALTER TABLE "Reward" ADD COLUMN "actionType" TEXT;
ALTER TABLE "Reward" ADD COLUMN "actionN" INTEGER;
