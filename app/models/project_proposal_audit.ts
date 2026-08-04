import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProjectProposal from '#models/project_proposal'

/** Lịch sử thay đổi trạng thái đề xuất */
export default class ProjectProposalAudit extends BaseModel {
  static table = 'project_proposal_audits'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectProposalId: number

  @column()
  declare actorUserId: number

  @column()
  declare action: string

  @column()
  declare fromStatus: string | null

  @column()
  declare toStatus: string | null

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare proposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => User, { foreignKey: 'actorUserId' })
  declare actor: BelongsTo<typeof User>
}
