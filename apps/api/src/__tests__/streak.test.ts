import { describe, it, expect } from "vitest"
import { computeStreakUpdate } from "@pulse/shared"

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000)
}

describe("computeStreakUpdate", () => {
  it("starts streak at 1 for first activity", () => {
    const r = computeStreakUpdate(0, 0, null)
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(1)
  })

  it("does not increment streak for same-day activity", () => {
    const r = computeStreakUpdate(5, 5, hoursAgo(2))
    expect(r.currentStreak).toBe(5)
  })

  it("increments streak for next-day activity within 36h window", () => {
    const r = computeStreakUpdate(5, 5, hoursAgo(25))
    expect(r.currentStreak).toBe(6)
  })

  it("resets streak to 1 when broken (>36h gap)", () => {
    const r = computeStreakUpdate(10, 10, hoursAgo(40))
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(10) // longest preserved
  })

  it("updates longestStreak when current exceeds it", () => {
    const r = computeStreakUpdate(9, 9, hoursAgo(25))
    expect(r.currentStreak).toBe(10)
    expect(r.longestStreak).toBe(10)
  })

  it("awards milestone bonus at 7 days", () => {
    const r = computeStreakUpdate(6, 6, hoursAgo(25))
    expect(r.currentStreak).toBe(7)
    expect(r.milestoneBonus).toBe(50)
  })

  it("awards milestone bonus at 30 days", () => {
    const r = computeStreakUpdate(29, 29, hoursAgo(25))
    expect(r.milestoneBonus).toBe(200)
  })

  it("no bonus on non-milestone days", () => {
    const r = computeStreakUpdate(3, 3, hoursAgo(25))
    expect(r.milestoneBonus).toBe(0)
  })
})
