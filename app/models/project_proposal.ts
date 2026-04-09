import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ResearchOutputType from '#models/research_output_type'

/** Trạng thái đề xuất đề tài */
export type ProjectProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNIT_REVIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'

/** Cấp đề tài */
export type ProjectProposalLevel = 'CO_SO' | 'TRUONG' | 'BO' | 'NHA_NUOC'

/** Mức độ ưu tiên Phòng KH */
export type SciDeptPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export default class ProjectProposal extends BaseModel {
  static table = 'project_proposals'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare field: string

  @column()
  declare level: ProjectProposalLevel

  @column()
  declare year: number

  @column()
  declare durationMonths: number

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare keywords: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare ownerId: number

  @column()
  declare ownerName: string

  @column()
  declare ownerEmail: string | null

  @column()
  declare ownerUnit: string

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare coAuthors: string[]

  @column()
  declare objectives: string

  @column()
  declare summary: string

  @column()
  declare contentOutline: string | null

  @column()
  declare expectedResults: string | null

  @column()
  declare applicationPotential: string | null

  @column()
  declare requestedBudgetTotal: number | null

  @column()
  declare requestedBudgetDetail: string | null

  @column()
  declare status: ProjectProposalStatus

  @column()
  declare academicYear: string | null

  /** Xếp loại nghiệm thu: EXCELLENT, PASS_ON_TIME, PASS_LATE */
  @column()
  declare acceptanceGrade: string | null

  /** Hệ số C phục vụ tính giờ (MULTIPLY_C) */
  @column()
  declare cFactor: number | null

  @column()
  declare unitComment: string | null

  @column()
  declare unitApproved: boolean | null

  @column()
  declare sciDeptComment: string | null

  @column()
  declare sciDeptPriority: SciDeptPriority | null

  /** Lá loại kết quả NCKH (KPI theo rule import). */
  @column()
  declare researchOutputTypeId: number | null

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @belongsTo(() => ResearchOutputType, { foreignKey: 'researchOutputTypeId' })
  declare researchOutputType: BelongsTo<typeof ResearchOutputType>

  /**
   * Sinh mã đề xuất: ĐT-{year}-{sequence 3 chữ số}
   */
  static async generateCode(year: number): Promise<string> {
    const last = await ProjectProposal.query()
      .where('code', 'like', `ĐT-${year}-%`)
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = lastSeq + 1
    }
    return `ĐT-${year}-${String(seq).padStart(3, '0')}`
  }
}
