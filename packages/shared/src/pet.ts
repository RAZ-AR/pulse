/**
 * Pet (tamagotchi) evolution — single source of truth shared by mobile + backend.
 *
 * Stage and hunger are *derived*, never stored:
 *   - stage  ← lifetime points (the more you earn, the more it evolves)
 *   - hungry ← current streak (skip a day and it gets hungry)
 *
 * The DB only persists `petName` and `petStageSeen` (the highest stage index the
 * user has already celebrated), so we can fire the hatch/evolution moment once.
 */

export type PetStage = {
  index: number
  threshold: number // min lifetime points to reach this stage
  key: string
  bg: string
}

export const PET_STAGES: PetStage[] = [
  { index: 0, threshold: 0,    key: "EGG",       bg: "#F0DFBD" },
  { index: 1, threshold: 50,   key: "HATCHLING", bg: "#FFF5C0" },
  { index: 2, threshold: 500,  key: "KID",       bg: "#FFE0EC" },
  { index: 3, threshold: 1500, key: "FOX",       bg: "#FFE4C0" },
  { index: 4, threshold: 3500, key: "DRAGON",    bg: "#C8E8FF" },
  { index: 5, threshold: 7000, key: "PHOENIX",   bg: "#FFF0A0" },
]

/** Resolve the current stage for a given lifetime-points total. */
export function petStageForPoints(lifetimePoints: number): PetStage {
  let resolved = PET_STAGES[0]!
  for (const stage of PET_STAGES) {
    if (lifetimePoints >= stage.threshold) resolved = stage
  }
  return resolved
}

/** Next stage after the given one, or null at max evolution. */
export function nextPetStage(stage: PetStage): PetStage | null {
  return PET_STAGES[stage.index + 1] ?? null
}

/** Progress [0..1] from current stage toward the next threshold. */
export function petProgress(lifetimePoints: number): number {
  const stage = petStageForPoints(lifetimePoints)
  const next = nextPetStage(stage)
  if (!next) return 1
  const span = next.threshold - stage.threshold
  return Math.min(1, (lifetimePoints - stage.threshold) / span)
}
