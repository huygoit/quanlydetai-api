import type { RuleKind } from '#models/research_output_rule'

/** Payload khi tạo/sửa rule (sau khi parse từ request). */
export interface RulePayload {
  ruleKind: string
  pointsValue?: number | null
  hoursValue?: number | null
  hoursMultiplierVar?: string | null
  hoursBonus?: number | null
  meta?: Record<string, unknown> | null
  evidenceRequirements?: string | null
}

/**
 * Validate payload theo từng rule_kind. Ném lỗi (message) nếu không hợp lệ.
 */
export function validateByKind(payload: RulePayload): void {
  const k = (payload.ruleKind || '').toUpperCase() as RuleKind
  const meta = payload.meta ?? {}

  switch (k) {
    case 'FIXED':
      if (payload.pointsValue === undefined || payload.pointsValue === null) {
        throw new Error('FIXED: points_value bắt buộc')
      }
      if (payload.hoursValue === undefined || payload.hoursValue === null) {
        throw new Error('FIXED: hours_value bắt buộc')
      }
      break
    case 'MULTIPLY_A':
      if (payload.pointsValue === undefined || payload.pointsValue === null) {
        throw new Error('MULTIPLY_A: points_value bắt buộc')
      }
      if (payload.hoursValue === undefined || payload.hoursValue === null) {
        throw new Error('MULTIPLY_A: hours_value bắt buộc')
      }
      if (payload.hoursMultiplierVar !== 'a') {
        throw new Error("MULTIPLY_A: hours_multiplier_var phải là 'a'")
      }
      break
    case 'HDGSNN_POINTS_TO_HOURS':
      if (payload.hoursValue !== 600) {
        throw new Error('HDGSNN_POINTS_TO_HOURS: hours_value phải là 600')
      }
      if (meta.source !== 'HDGSNN' || meta.hours_per_point !== 600) {
        throw new Error('HDGSNN_POINTS_TO_HOURS: meta phải có { "source": "HDGSNN", "hours_per_point": 600 }')
      }
      break
    case 'MULTIPLY_C':
      if (payload.pointsValue === undefined || payload.pointsValue === null) {
        throw new Error('MULTIPLY_C: points_value bắt buộc')
      }
      if (payload.hoursValue === undefined || payload.hoursValue === null) {
        throw new Error('MULTIPLY_C: hours_value bắt buộc')
      }
      if (payload.hoursMultiplierVar !== 'c') {
        throw new Error("MULTIPLY_C: hours_multiplier_var phải là 'c'")
      }
      const cMap = (meta as { c_map?: Record<string, number> }).c_map
      if (
        !cMap ||
        typeof cMap !== 'object' ||
        cMap.EXCELLENT === undefined ||
        cMap.PASS_ON_TIME === undefined ||
        cMap.PASS_LATE === undefined
      ) {
        throw new Error(
          'MULTIPLY_C: meta phải có c_map: { "EXCELLENT": 1.1, "PASS_ON_TIME": 1.0, "PASS_LATE": 0.5 }'
        )
      }
      break
    case 'RANGE_REVENUE':
      const ranges = (meta as { ranges?: Array<{ min: number; max: number | null; points?: number; hours?: number }> })
        .ranges
      if (!Array.isArray(ranges) || ranges.length === 0) {
        throw new Error('RANGE_REVENUE: meta phải có ranges (mảng object min, max, points, hours)')
      }
      for (const r of ranges) {
        if (typeof r.min !== 'number' || (r.max != null && typeof r.max !== 'number')) {
          throw new Error('RANGE_REVENUE: mỗi range cần min, max (nullable), points, hours')
        }
      }
      break
    case 'BONUS_ADD':
      if (payload.pointsValue === undefined || payload.pointsValue === null) {
        throw new Error('BONUS_ADD: points_value bắt buộc')
      }
      if (payload.hoursValue === undefined || payload.hoursValue === null) {
        throw new Error('BONUS_ADD: hours_value bắt buộc')
      }
      if (payload.hoursBonus === undefined || payload.hoursBonus === null) {
        throw new Error('BONUS_ADD: hours_bonus bắt buộc')
      }
      break
    default:
      throw new Error(
        `rule_kind không hợp lệ. Chỉ chấp nhận: FIXED, MULTIPLY_A, HDGSNN_POINTS_TO_HOURS, MULTIPLY_C, RANGE_REVENUE, BONUS_ADD`
      )
  }
}

const RULE_KINDS = ['FIXED', 'MULTIPLY_A', 'HDGSNN_POINTS_TO_HOURS', 'MULTIPLY_C', 'RANGE_REVENUE', 'BONUS_ADD'] as const

export function isRuleKind(s: string): s is RuleKind {
  return RULE_KINDS.includes(s as RuleKind)
}
