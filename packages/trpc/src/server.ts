export { computeReceiptHash } from "./services/ocr"

import { router } from "./trpc"
import { authRouter } from "./routers/auth"
import { badgeRouter } from "./routers/badge"
import { userRouter } from "./routers/user"
import { venueRouter } from "./routers/venue"
import { transactionRouter } from "./routers/transaction"
import { checkinRouter } from "./routers/checkin"
import { rewardRouter } from "./routers/reward"
import { challengeRouter } from "./routers/challenge"
import { socialRouter } from "./routers/social"
import { leaderboardRouter } from "./routers/leaderboard"
import { merchantRouter } from "./routers/merchant"

export const appRouter = router({
  auth: authRouter,
  badge: badgeRouter,
  user: userRouter,
  venue: venueRouter,
  transaction: transactionRouter,
  checkin: checkinRouter,
  reward: rewardRouter,
  challenge: challengeRouter,
  social: socialRouter,
  leaderboard: leaderboardRouter,
  merchant: merchantRouter,
})

export type AppRouter = typeof appRouter
