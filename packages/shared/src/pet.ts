/**
 * Pet (tamagotchi) — a *collection* that grows as you earn points.
 *
 * Lifecycle:
 *   - Egg (the EGG sprite) appears ONLY during onboarding and hatches into the
 *     first pet for the 500-point welcome bonus.
 *   - Each points threshold unlocks a NEW creature. The newest is the "current"
 *     one (big + animated on the home card); earlier ones become small collected
 *     icons shown above the points balance.
 *
 * Stage/hunger are derived, never stored. The DB persists only `petName`
 * (collection mascot name) and `petStageSeen` (how many pets the user has
 * already celebrated) so the "new pet" moment fires once.
 */

export type Pet = {
  index: number     // position in the collection (0 = first)
  threshold: number // points needed to unlock
  key: string       // sprite key
  bg: string        // tint (used on the /pet collection screen)
}

// The EGG sprite is onboarding-only and intentionally NOT part of the collection.
export const PET_COLLECTION: Pet[] = [
  { index: 0, threshold: 500,  key: "HATCHLING", bg: "#FFF5C0" },
  { index: 1, threshold: 1500, key: "KID",       bg: "#FFE0EC" },
  { index: 2, threshold: 3000, key: "FOX",       bg: "#FFE4C0" },
  { index: 3, threshold: 5000, key: "DRAGON",    bg: "#C8E8FF" },
  { index: 4, threshold: 8000, key: "PHOENIX",   bg: "#FFF0A0" },
]

/** Pets whose threshold the points total has reached, in order. */
export function unlockedPets(points: number): Pet[] {
  return PET_COLLECTION.filter((p) => points >= p.threshold)
}

/**
 * Pets to display in the collection. Once hatched we always show at least the
 * first one, even before the 500 threshold (covers the onboarding hand-off).
 */
export function collectedPets(points: number, hatched: boolean): Pet[] {
  if (!hatched) return []
  const unlocked = unlockedPets(points)
  return unlocked.length ? unlocked : [PET_COLLECTION[0]!]
}

/** The current (newest, animated) pet, or null if not hatched. */
export function currentPet(points: number, hatched: boolean): Pet | null {
  const collected = collectedPets(points, hatched)
  return collected[collected.length - 1] ?? null
}

/** Next pet to unlock, or null when the collection is complete. */
export function nextPet(points: number): Pet | null {
  return PET_COLLECTION.find((p) => points < p.threshold) ?? null
}

/** Progress [0..1] from the current pet toward the next one. */
export function collectionProgress(points: number): number {
  const next = nextPet(points)
  if (!next) return 1
  const unlocked = unlockedPets(points)
  const base = unlocked.length ? unlocked[unlocked.length - 1]!.threshold : 0
  return Math.min(1, Math.max(0, (points - base) / (next.threshold - base)))
}
