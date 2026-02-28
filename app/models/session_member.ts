import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CouncilSession from '#models/council_session'
import User from '#models/user'

export default class SessionMember extends BaseModel {
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

  @belongsTo(() => CouncilSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof CouncilSession>

  @belongsTo(() => User, { foreignKey: 'memberId' })
  declare member: BelongsTo<typeof User>
}
