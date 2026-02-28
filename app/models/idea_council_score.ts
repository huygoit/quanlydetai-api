import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import CouncilSession from '#models/council_session'
import Idea from '#models/idea'
import User from '#models/user'

export default class IdeaCouncilScore extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare ideaId: number

  @column()
  declare councilMemberId: number

  @column()
  declare councilMemberName: string

  @column()
  declare councilRole: string

  @column()
  declare noveltyScore: number

  @column()
  declare noveltyComment: string | null

  @column()
  declare feasibilityScore: number

  @column()
  declare feasibilityComment: string | null

  @column()
  declare alignmentScore: number

  @column()
  declare alignmentComment: string | null

  @column()
  declare authorCapacityScore: number

  @column()
  declare authorCapacityComment: string | null

  @column()
  declare weightedScore: number

  @column()
  declare generalComment: string | null

  @column()
  declare submitted: boolean

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => CouncilSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof CouncilSession>

  @belongsTo(() => Idea, { foreignKey: 'ideaId' })
  declare idea: BelongsTo<typeof Idea>

  @belongsTo(() => User, { foreignKey: 'councilMemberId' })
  declare councilMember: BelongsTo<typeof User>
}
