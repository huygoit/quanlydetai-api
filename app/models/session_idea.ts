import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CouncilSession from '#models/council_session'
import Idea from '#models/idea'

export default class SessionIdea extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare ideaId: number

  @column()
  declare ideaCode: string

  @column()
  declare ideaTitle: string

  @column()
  declare ownerName: string

  @column()
  declare ownerUnit: string

  @column()
  declare field: string

  @column()
  declare statusSnapshot: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => CouncilSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof CouncilSession>

  @belongsTo(() => Idea, { foreignKey: 'ideaId' })
  declare idea: BelongsTo<typeof Idea>
}
