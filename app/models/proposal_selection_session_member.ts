import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProposalSelectionSession from '#models/proposal_selection_session'
import User from '#models/user'

/**
 * Thành viên hội đồng thuộc phiên xét chọn đề tài.
 */
export default class ProposalSelectionSessionMember extends BaseModel {
  static table = 'proposal_selection_session_members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare memberId: number

  @column()
  declare memberName: string

  @column()
  declare memberEmail: string | null

  @column()
  declare roleInCouncil: string

  @column()
  declare unit: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => ProposalSelectionSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProposalSelectionSession>

  @belongsTo(() => User, { foreignKey: 'memberId' })
  declare member: BelongsTo<typeof User>
}
