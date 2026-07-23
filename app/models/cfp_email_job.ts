import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CallForProposal from '#models/call_for_proposal'

export type CfpEmailJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export default class CfpEmailJob extends BaseModel {
  static table = 'cfp_email_jobs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare callForProposalId: number

  @column()
  declare status: CfpEmailJobStatus

  @column()
  declare total: number

  @column()
  declare sent: number

  @column()
  declare error: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => CallForProposal, { foreignKey: 'callForProposalId' })
  declare callForProposal: BelongsTo<typeof CallForProposal>
}
