/**
 * Types cho KPI Engine (giờ NCKH theo QĐ 1883).
 */

export interface CalculationResult {
  hours: number
  warnings: string[]
  details?: Record<string, unknown>
}

/** Rule bản ghi từ research_output_rules (canonical, theo type_id) */
export interface KpiRuleRow {
  ruleKind: string
  baseHours: number | null
  pointsValue: number | null
  hoursValue: number | null
  hoursMultiplierVar: string | null
  hoursBonus: number | null
}

export interface KpiContext {
  profileId: number
  academicYear: string
  isFemale?: boolean
}

/** Output có thể là publication, project, book, ... */
export type KpiOutput =
  | {
      type: 'PUBLICATION'
      publication: {
        id: number
        rank: string | null
        quartile: string | null
        domesticRuleType?: string | null
      }
      authors: Array<{ profileId: number | null; isMainAuthor: boolean; affiliationType: string; isMultiAffiliationOutsideUdn: boolean }>
    }
  | { type: 'PROJECT'; project: { id: number; level: string; acceptanceGrade: string | null; cFactor: number | null } }
  | { type: 'BOOK'; payload: Record<string, unknown> }
  | { type: 'PATENT'; payload: Record<string, unknown> }
  | { type: 'TECHNOLOGY_TRANSFER'; payload: Record<string, unknown> }
  | { type: 'STUDENT_RESEARCH'; payload: Record<string, unknown> }
  | { type: 'INNOVATION' | 'AWARD' | 'ART_WORK' | 'PERFORMANCE' | 'SEMINAR'; payload: Record<string, unknown> }

export interface IKpiCalculatorStrategy {
  supports(output: KpiOutput): boolean
  calculate(output: KpiOutput, context: KpiContext): Promise<CalculationResult> | CalculationResult
}
