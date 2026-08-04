import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProjectProposal from '#models/project_proposal'

/** Phiên bản điều chỉnh đề xuất theo yêu cầu HĐ (US-03-05) */
export type AdjustmentVersionType = 'ORIGINAL' | 'SUBMITTED'

export default class ProjectProposalAdjustmentVersion extends BaseModel {
  static table = 'project_proposal_adjustment_versions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectProposalId: number

  @column()
  declare versionType: AdjustmentVersionType

  @column()
  declare title: string

  @column()
  declare objectives: string

  @column()
  declare councilAdjustmentNote: string | null

  @column()
  declare explanationNote: string | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare proposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>
}
