import { STREAK_FORGIVENESS_HOURS, STREAK_MILESTONES } from "./constants"

export type StreakUpdate = {
  currentStreak: number
  longestStreak: number
  milestoneBonus: number
}

export function computeStreakUpdate(
  currentStreak: number,
  longestStreak: number,
  lastActivityAt: Date | null,
): StreakUpdate {
  const now = new Date()

  if (!lastActivityAt) {
    return { currentStreak: 1, longestStreak: Math.max(1, longestStreak), milestoneBonus: 0 }
  }

  const hoursSince = (now.getTime() - lastActivityAt.getTime()) / 3_600_000

  let newStreak: number
  if (hoursSince < 24) {
    newStreak = currentStreak          // same calendar day — no change
  } else if (hoursSince <= STREAK_FORGIVENESS_HOURS) {
    newStreak = currentStreak + 1      // next day within forgiveness window
  } else {
    newStreak = 1                      // streak broken
  }

  const newLongest = Math.max(newStreak, longestStreak)
  const milestoneBonus = STREAK_MILESTONES[newStreak] ?? 0

  return { currentStreak: newStreak, longestStreak: newLongest, milestoneBonus }
}
