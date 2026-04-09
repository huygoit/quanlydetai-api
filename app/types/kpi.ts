/**
 * Types cho KPI Engine (giờ NCKH theo QĐ 1883).
 */

export interface CalculationResult {
  hours: number
  /** Điểm quy đổi (theo danh mục KQNC / điểm HĐGSNN), phân bổ theo vai trò tác giả — không nhân hệ số giới */
  points?: number
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
  /** Họ tên hồ sơ — dùng khớp tác giả khi bảng tác giả chưa có profile_id */
  profileFullName?: string | null
}

/** Output có thể là publication, project, book, ... */
export type KpiOutput =
  | {
      type: 'PUBLICATION'
      publication: {
        id: number
        /** Chủ sở hữu bản ghi công bố (scientific_profiles.id) */
        ownerProfileId: number
        researchOutputTypeId: number | null
        hdgsnnScore?: number | null
      }
      authors: Array<{
        profileId: number | null
        fullName: string
        isMainAuthor: boolean
        isCorresponding: boolean
        affiliationType: string
        isMultiAffiliationOutsideUdn: boolean
      }>
    }
  | {
      type: 'PROJECT'
      project: {
        id: number
        researchOutputTypeId: number | null
        level: string
        acceptanceGrade: string | null
        cFactor: number | null
      }
    }
  | { type: 'BOOK'; payload: Record<string, unknown> }
  | { type: 'PATENT'; payload: Record<string, unknown> }
  | { type: 'TECHNOLOGY_TRANSFER'; payload: Record<string, unknown> }
  | { type: 'STUDENT_RESEARCH'; payload: Record<string, unknown> }
  | { type: 'INNOVATION' | 'AWARD' | 'ART_WORK' | 'PERFORMANCE' | 'SEMINAR'; payload: Record<string, unknown> }

export interface IKpiCalculatorStrategy {
  supports(output: KpiOutput): boolean
  calculate(output: KpiOutput, context: KpiContext): Promise<CalculationResult> | CalculationResult
}
