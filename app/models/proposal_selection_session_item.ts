import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProposalSelectionSession from '#models/proposal_selection_session'
import ProjectProposal from '#models/project_proposal'
import User from '#models/user'

/** Kết quả HĐ trên từng đề xuất */
export type CouncilResult = 'DONG_Y' | 'DONG_Y_DIEU_CHINH' | 'KHONG_DONG_Y'

export default class ProposalSelectionSessionItem extends BaseModel {
  static table = 'proposal_selection_session_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare projectProposalId: number

  @column()
  declare councilOpinion: string | null

  @column()
  declare councilResult: CouncilResult | string | null

  @column()
  declare adjustmentNote: string | null

  @column()
  declare resultEnteredBy: number | null

  @column.dateTime()
  declare resultEnteredAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProposalSelectionSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProposalSelectionSession>

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare projectProposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => User, { foreignKey: 'resultEnteredBy' })
  declare enteredByUser: BelongsTo<typeof User>
}
