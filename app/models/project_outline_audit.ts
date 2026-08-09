import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ProjectOutlineAudit extends BaseModel {
  static table = 'project_outline_audits'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare actorId: number | null

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
}
