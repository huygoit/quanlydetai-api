/**
 * Công thức tính điểm có trọng số cho chấm ý tưởng hội đồng.
 */
export const COUNCIL_WEIGHTS = {
  novelty: 0.3,
  feasibility: 0.3,
  alignment: 0.2,
  authorCapacity: 0.2,
} as const

export const THRESHOLD_SCORE = 7.0

export function calculateWeightedScore(scores: {
  novelty: number
  feasibility: number
  alignment: number
  authorCapacity: number
}): number {
  const w = COUNCIL_WEIGHTS
  const weighted =
    scores.novelty * w.novelty +
    scores.feasibility * w.feasibility +
    scores.alignment * w.alignment +
    scores.authorCapacity * w.authorCapacity
  return Math.round(weighted * 100) / 100
}
