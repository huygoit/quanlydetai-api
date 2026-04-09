import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'

const SIMPLE_TYPES = [
  'BOOK',
  'PATENT',
  'TECHNOLOGY_TRANSFER',
  'STUDENT_RESEARCH',
  'INNOVATION',
  'AWARD',
  'ART_WORK',
  'PERFORMANCE',
  'SEMINAR',
] as const

export function simpleFixedStrategySupports(output: KpiOutput): boolean {
  return SIMPLE_TYPES.includes(output.type as (typeof SIMPLE_TYPES)[number])
}

export async function simpleFixedStrategyCalculate(
  output: KpiOutput,
  _context: KpiContext
): Promise<CalculationResult> {
  const warnings: string[] = []
  const hours = 0
  warnings.push(`Loại ${output.type}: chưa có nguồn dữ liệu trong hệ thống`)
  return { hours, points: 0, warnings, details: { type: output.type } }
}
