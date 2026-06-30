/**
 * Types cho KPI Engine (giờ NCKH theo QĐ 1883).
 */

export interface CalculationResult {
  hours: number
  /** Điểm quy đổi = giờ quy đổi / 600 (sau toàn bộ hệ số và điều kiện áp dụng). */
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

/**
 * Cache preload type/rule để tránh query lặp khi tính KPI hàng loạt (báo cáo nhiều hồ sơ).
 * `ruleByTypeId` giữ nguyên instance ResearchOutputRule để strategy đọc meta/hoursValue như cũ.
 */
export interface KpiEngineCache {
  typeById: Map<number, { code: string | null; phamViHeSoA1883: string | null }>
  ruleByTypeId: Map<number, unknown>
}

export interface KpiContext {
  profileId: number
  academicYear: string
  isFemale?: boolean
  /** Họ tên hồ sơ — dùng khớp tác giả khi bảng tác giả chưa có profile_id */
  profileFullName?: string | null
  /** Cache type/rule dùng chung khi tính hàng loạt; không có thì strategy tự query DB. */
  ruleCache?: KpiEngineCache
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
        /** Xếp loại nghiệm thu (đề tài rule MULTIPLY_C): EXCELLENT | PASS_ON_TIME | PASS_LATE */
        acceptanceGrade?: string | null
      }
      authors: Array<{
        profileId: number | null
        fullName: string
        isTopAuthor: boolean
        isCorresponding: boolean
        affiliationType: string
        isMultiAffiliationOutsideUdn: boolean
        /** % đóng góp (mục 1.4) — dùng chia giờ cho sản phẩm KH khác (sách, đề tài, sáng kiến…). */
        contributionPercent?: number | null
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
