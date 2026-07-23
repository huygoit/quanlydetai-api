import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import CallForProposal from '#models/call_for_proposal'

export type SubmissionPeriodStatus = 'OPEN' | 'CLOSED'

export default class SubmissionPeriod extends BaseModel {
  static table = 'submission_periods'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare callForProposalId: number

  @column.dateTime()
  declare deadlineAt: DateTime

  @column()
  declare status: SubmissionPeriodStatus

  @column.dateTime()
  declare closedAt: DateTime | null

  @column()
  declare closedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => CallForProposal, { foreignKey: 'callForProposalId' })
  declare callForProposal: BelongsTo<typeof CallForProposal>

  @belongsTo(() => User, { foreignKey: 'closedBy' })
  declare closer: BelongsTo<typeof User>

  /** Kỳ còn nhận hồ sơ: OPEN và chưa quá hạn. */
  isAcceptingNow(ref = DateTime.local()): boolean {
    if (this.status !== 'OPEN') return false
    return this.deadlineAt >= ref.startOf('day')
  }
}
