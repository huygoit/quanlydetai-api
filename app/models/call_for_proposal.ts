import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import SubmissionPeriod from '#models/submission_period'
import CallForProposalAudit from '#models/call_for_proposal_audit'
import type { ProjectProposalLevel } from '#models/project_proposal'

export type CfpStatus = 'DRAFT' | 'PENDING_BGH' | 'RETURNED' | 'APPROVED' | 'PUBLISHED'
export type CfpPeriodKind = 'ACADEMIC' | 'FINANCIAL'

export default class CallForProposal extends BaseModel {
  static table = 'call_for_proposals'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare periodKind: CfpPeriodKind

  @column()
  declare periodLabel: string

  @column.dateTime()
  declare deadlineAt: DateTime

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare levels: ProjectProposalLevel[]

  @column()
  declare contentHtml: string | null

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare attachmentUrls: string[]

  @column()
  declare status: CfpStatus

  @column()
  declare createdBy: number

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column()
  declare approvedBy: number | null

  @column.dateTime()
  declare approvedAt: DateTime | null

  @column()
  declare returnReason: string | null

  @column()
  declare publishedBy: number | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column()
  declare officialDocNo: string | null

  @column.date()
  declare officialDocDate: DateTime | null

  @column()
  declare signedFileUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'approvedBy' })
  declare approver: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'publishedBy' })
  declare publisher: BelongsTo<typeof User>

  @hasOne(() => SubmissionPeriod, { foreignKey: 'callForProposalId' })
  declare submissionPeriod: HasOne<typeof SubmissionPeriod>

  @hasMany(() => CallForProposalAudit, { foreignKey: 'callForProposalId' })
  declare audits: HasMany<typeof CallForProposalAudit>
}
