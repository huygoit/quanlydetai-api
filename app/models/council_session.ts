import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import SessionMember from '#models/session_member'
import SessionIdea from '#models/session_idea'

export type CouncilSessionStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED'

export default class CouncilSession extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare year: number

  @column.date()
  declare meetingDate: DateTime | null

  @column()
  declare location: string | null

  @column()
  declare status: CouncilSessionStatus

  @column()
  declare createdById: number

  @column()
  declare createdByName: string

  @column()
  declare memberCount: number

  @column()
  declare ideaCount: number

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdById' })
  declare createdBy: BelongsTo<typeof User>

  @hasMany(() => SessionMember, { foreignKey: 'sessionId' })
  declare members: HasMany<typeof SessionMember>

  @hasMany(() => SessionIdea, { foreignKey: 'sessionId' })
  declare sessionIdeas: HasMany<typeof SessionIdea>

  static async generateCode(): Promise<string> {
    const year = new Date().getFullYear()
    const last = await CouncilSession.query()
      .whereRaw('code LIKE ?', [`HDYT-${year}-%`])
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      seq = parseInt(parts[2] || '0', 10) + 1
    }
    return `HDYT-${year}-${String(seq).padStart(2, '0')}`
  }
}
