import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutline from '#models/project_outline'

/** TM thuộc một phiên thẩm định (nhiều TM / phiên) */
export default class ProjectOutlineDefenseSessionOutline extends BaseModel {
  static table = 'project_outline_defense_session_outlines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare projectOutlineId: number

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineDefenseSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProjectOutlineDefenseSession>

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>
}
