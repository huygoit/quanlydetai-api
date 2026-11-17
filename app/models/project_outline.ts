import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProjectProposal from '#models/project_proposal'
import ProjectProcessType from '#models/project_process_type'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'

import type { ExecutionStatus } from '#constants/module56'
import { jsonAttr } from '#utils/json_attr'

export type ProjectOutlineStatus =
  | 'THUYETMINH_DRAFT'
  | 'THUYETMINH_PENDING'
  | 'PHANBIEN_KIN'
  | 'BAOVE_PENDING'
  | 'CHINH_SUA_TM'
  | 'CHO_HD_XAC_NHAN_TM'
  | 'CHO_PKH_DUYET_TM'
  | 'CHO_BGH_DUYET_TM'
  | 'CHO_HC_PHAT_HANH_QD'
  /** @deprecated US-04-06 đã bỏ — giữ để đọc dữ liệu cũ */
  | 'CHO_XAC_NHAN_KP'
  | 'CHO_TC_THAM_TRA'
  | 'LDPD_PENDING'
  | 'SAN_SANG_THUC_HIEN'
  | 'KHONG_PHE_DUYET'
  | 'BAOVE_KHONG_DAT'

export type OutlineMilestone = {
  content: string
  startDate?: string | null
  endDate?: string | null
  expectedResult?: string | null
}

export type OutlineProduct = {
  name: string
  quantity?: string | null
  quality?: string | null
}

/** Công bố khoa học */
export type OutlineExpectedPublication = {
  id: string
  /** Trong nước / Quốc tế */
  category: 'DOMESTIC' | 'INTERNATIONAL' | string
  content: string
  quantity?: string | null
  scienceRequirement?: string | null
  note?: string | null
}

/** Sản phẩm nguyên lý / phương pháp / phần mềm / … */
export type OutlineExpectedAppliedProduct = {
  id: string
  name: string
  scienceRequirement?: string | null
  note?: string | null
}

/** Mẫu / hàng hóa / thiết bị / giống … */
export type OutlineExpectedTangibleProduct = {
  id: string
  name: string
  unit?: string | null
  qualityRequired?: string | null
  qualitySampleDomestic?: string | null
  qualitySampleWorld?: string | null
  quantityScale?: string | null
}

/** Đăng ký SHTT / SHCN / giống … */
export type OutlineExpectedIpProduct = {
  id: string
  name: string
  scienceRequirement?: string | null
  note?: string | null
}

/** Đào tạo sau đại học */
export type OutlineExpectedTraining = {
  id: string
  level: string
  quantity?: string | null
  major?: string | null
  note?: string | null
}

/** Kết quả dự kiến — 5 nhóm */
export type OutlineExpectedResults = {
  publications: OutlineExpectedPublication[]
  appliedProducts: OutlineExpectedAppliedProduct[]
  tangibleProducts: OutlineExpectedTangibleProduct[]
  ipProducts: OutlineExpectedIpProduct[]
  postgraduateTraining: OutlineExpectedTraining[]
}

export type OutlinePartnerUnit = {
  name: string
  orgCode?: string | null
  phone?: string | null
  address?: string | null
  /** Giữ tương thích dữ liệu cũ */
  role?: string | null
}

/** Tổ chức chủ trì nhiệm vụ */
export type OutlineHostOrganization = {
  name: string
  orgCode?: string | null
  phone?: string | null
  address?: string | null
  leaderName?: string | null
  /** Năng lực, kinh nghiệm CSVC / dự án (HTML) */
  experienceHtml?: string | null
  /** Đội ngũ nhân lực (HTML) */
  teamCapacityHtml?: string | null
}

/** Snapshot chủ nhiệm nhiệm vụ (hiển thị BM / form) */
export type OutlinePrincipalInfo = {
  profileId?: number | null
  fullName?: string | null
  identityNumber?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  academicTitleDegree?: string | null
  professionalTitle?: string | null
  position?: string | null
  phone?: string | null
  email?: string | null
  organization?: string | null
  workAddress?: string | null
}

/** Ma trận kinh phí thực hiện (nguồn × khoản chi) — mirror FE constants */
export type OutlineBudgetMatrix = {
  STATE_LUMP: Record<string, number>
  STATE_NON_LUMP: Record<string, number>
  NON_STATE: Record<string, number>
}

/** Các mục mô tả bổ sung (ứng dụng, hiệu quả, rủi ro, đạo đức/AI) */
export type OutlineOtherContents = {
  /** Khả năng ứng dụng & chuyển giao kết quả */
  applicationTransferHtml?: string | null
  /** Dự kiến hiệu quả đầu ra */
  outputEffectivenessHtml?: string | null
  /** Dự kiến tác động của kết quả */
  impactAssessmentHtml?: string | null
  /** Quản lý rủi ro và biện pháp kiểm soát */
  riskManagementHtml?: string | null
  /** Đối tượng/dữ liệu đặc thù & thủ tục phê duyệt */
  ethicsDataApprovalHtml?: string | null
  /** Kế hoạch quản lý dữ liệu */
  dataManagementPlanHtml?: string | null
  /** SHTT / quyền bên thứ ba */
  ipProtectionHtml?: string | null
  /** Sử dụng AI (nếu có) */
  aiUsageHtml?: string | null
}

/** Phương thức khoán chi (BM-02.02 §5) */
export type OutlineLumpSumMode = 'FULL' | 'PARTIAL'

/**
 * Phân bổ nguồn kinh phí đề xuất (BM-02.02 §4–5).
 * a) schoolFund + externalFund | b) stateBudget + nonStateBudget
 * §5: lumpSumMode + lumpSumAmount + nonLumpSumAmount
 * Trường legacy external* chỉ còn khi đọc JSON cũ.
 */
export type OutlineFundingBreakdown = {
  /** Kinh phí từ Trường */
  schoolFund: number
  /** Kinh phí ngoài Trường */
  externalFund: number
  /** Ngân sách nhà nước */
  stateBudget: number
  /** Ngoài ngân sách nhà nước (Quỹ KHCN Trường…) */
  nonStateBudget: number
  /** FULL = khoán đến SP cuối; PARTIAL = khoán từng phần */
  lumpSumMode: OutlineLumpSumMode | null
  /** Kinh phí khoán */
  lumpSumAmount: number
  /** Kinh phí không khoán */
  nonLumpSumAmount: number
  /** @deprecated — gộp vào externalFund */
  externalStateLocal?: number
  /** @deprecated */
  externalEnterprise?: number
  /** @deprecated */
  externalSponsor?: number
  /** @deprecated */
  externalOther?: number
}

export default class ProjectOutline extends BaseModel {
  static table = 'project_outlines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectProposalId: number

  @column()
  declare code: string

  @column()
  declare status: ProjectOutlineStatus

  @column()
  declare title: string

  @column()
  declare projectProcessTypeId: number | null

  @column()
  declare level: string | null

  @column()
  declare field: string | null

  @column.dateTime()
  declare startDate: DateTime | null

  @column.dateTime()
  declare endDate: DateTime | null

  @column()
  declare requestedBudget: number

  @column(jsonAttr<OutlineFundingBreakdown | null>(null))
  declare fundingBreakdown: OutlineFundingBreakdown | null

  @column(
    jsonAttr<OutlineBudgetMatrix | null>({
      STATE_LUMP: {},
      STATE_NON_LUMP: {},
      NON_STATE: {},
    })
  )
  declare budgetMatrix: OutlineBudgetMatrix | null

  @column(jsonAttr<OutlinePrincipalInfo | null>(null))
  declare principalInfo: OutlinePrincipalInfo | null

  @column()
  declare hostUnit: string | null

  @column(jsonAttr<OutlineHostOrganization | null>(null))
  declare hostOrganization: OutlineHostOrganization | null

  @column({
    prepare: (v: OutlinePartnerUnit[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (Array.isArray(v)) return v as OutlinePartnerUnit[]
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p : []
        } catch {
          return []
        }
      }
      return []
    },
  })
  declare partnerUnits: OutlinePartnerUnit[]

  @column()
  declare urgency: string | null

  @column()
  declare detailedObjectives: string | null

  @column()
  declare researchContent: string | null

  @column()
  declare methodology: string | null

  @column({
    prepare: (v: OutlineMilestone[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (Array.isArray(v)) return v as OutlineMilestone[]
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p : []
        } catch {
          return []
        }
      }
      return []
    },
  })
  declare milestones: OutlineMilestone[]

  @column({
    prepare: (v: OutlineProduct[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (Array.isArray(v)) return v as OutlineProduct[]
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p : []
        } catch {
          return []
        }
      }
      return []
    },
  })
  declare expectedProducts: OutlineProduct[]

  @column(
    jsonAttr<OutlineExpectedResults | null>({
      publications: [],
      appliedProducts: [],
      tangibleProducts: [],
      ipProducts: [],
      postgraduateTraining: [],
    })
  )
  declare expectedResults: OutlineExpectedResults | null

  @column(jsonAttr<OutlineOtherContents | null>(null))
  declare otherContents: OutlineOtherContents | null

  @column()
  declare summary: string | null

  @column()
  declare councilFeedback: string | null

  @column()
  declare outlineFileUrl: string | null

  @column()
  declare appendixFileUrl: string | null

  @column()
  declare completionPercent: number

  @column()
  declare ownerId: number

  @column()
  declare ownerName: string

  @column()
  declare ownerEmail: string | null

  @column()
  declare ownerUnit: string | null

  @column()
  declare submittedBy: number | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime()
  declare withdrawnAt: DateTime | null

  @column.dateTime()
  declare reviewAssignedAt: DateTime | null

  @column()
  declare reviewAssignedBy: number | null

  @column()
  declare reviewerCountTarget: number | null

  @column()
  declare reviewAverageScore: number | null

  @column()
  declare reviewBelowThreshold: boolean | null

  @column.dateTime()
  declare reviewScoresCompletedAt: DateTime | null

  @column()
  declare activeDefenseSessionId: number | null

  @column.dateTime()
  declare defenseScheduledAt: DateTime | null

  @column()
  declare defenseConclusion: string | null

  @column.dateTime()
  declare defenseFinalizedAt: DateTime | null

  @column.dateTime()
  declare revisionDeadline: DateTime | null

  @column()
  declare revisionExplanation: string | null

  @column()
  declare revisionBaselineVersionId: number | null

  @column()
  declare revisionSubmittedVersionId: number | null

  @column.dateTime()
  declare revisionSubmittedAt: DateTime | null

  /** CHO_PKH | CHO_THU_KY | CHO_CHU_TICH | CHO_BGH — cổng sau nộp bản hoàn thiện */
  @column()
  declare revisionGateStatus: 'CHO_PKH' | 'CHO_THU_KY' | 'CHO_CHU_TICH' | 'CHO_BGH' | null

  @column()
  declare revisionReturnReason: string | null

  @column.dateTime()
  declare revisionReminderSentAt: DateTime | null

  @column()
  declare activeBudgetConfirmationId: number | null

  @column()
  declare confirmedBudget: number | null

  @column()
  declare approvedBudget: number | null

  @column()
  declare bghDecisionNote: string | null

  @column.dateTime()
  declare bghSignedAt: DateTime | null

  @column()
  declare bghSignedBy: number | null

  @column()
  declare bghRejectReason: string | null

  @column()
  declare assignmentDecisionUrl: string | null

  @column.dateTime()
  declare hcPublishedAt: DateTime | null

  @column()
  declare hcPublishedBy: number | null

  // snakeCase mặc định tách thành module_5_opened_at, lệch cột thật module5_opened_at
  @column.dateTime({ columnName: 'module5_opened_at' })
  declare module5OpenedAt: DateTime | null

  @column({ columnName: 'module5_opened' })
  declare module5Opened: boolean

  @column()
  declare activeContractId: number | null

  @column()
  declare contractStatus: string | null

  @column()
  declare executionStatus: ExecutionStatus | null

  @column()
  declare extensionCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare projectProposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @belongsTo(() => ProjectProcessType, { foreignKey: 'projectProcessTypeId' })
  declare projectProcessType: BelongsTo<typeof ProjectProcessType>

  @hasMany(() => ProjectOutlineMember, { foreignKey: 'projectOutlineId' })
  declare members: HasMany<typeof ProjectOutlineMember>

  @hasMany(() => ProjectOutlineBudgetLine, { foreignKey: 'projectOutlineId' })
  declare budgetLines: HasMany<typeof ProjectOutlineBudgetLine>

  @hasMany(() => ProjectOutlineReviewAssignment, { foreignKey: 'projectOutlineId' })
  declare reviewAssignments: HasMany<typeof ProjectOutlineReviewAssignment>
}
