import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProjectProposal from '#models/project_proposal'
import ProjectProcessType from '#models/project_process_type'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'

export type ProjectOutlineStatus =
  | 'THUYETMINH_DRAFT'
  | 'THUYETMINH_PENDING'
  | 'PHANBIEN_KIN'
  | 'BAOVE_PENDING'
  | 'CHINH_SUA_TM'
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

export type OutlinePartnerUnit = {
  name: string
  role?: string | null
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

  @column()
  declare hostUnit: string | null

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
  declare applicationScope: string | null

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

  @column.dateTime()
  declare revisionReminderSentAt: DateTime | null

  @column()
  declare activeBudgetConfirmationId: number | null

  @column()
  declare confirmedBudget: number | null

  @column()
  declare approvedBudget: number | null

  @column.dateTime()
  declare module5OpenedAt: DateTime | null

  @column()
  declare module5Opened: boolean

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
