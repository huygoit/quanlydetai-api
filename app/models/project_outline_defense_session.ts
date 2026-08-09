import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import User from '#models/user'

export type DefenseSessionStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'FINALIZED'
export type DefenseMeetingMode = 'IN_PERSON' | 'ONLINE' | 'HYBRID'
export type DefenseConclusion = 'THONG_QUA' | 'THONG_QUA_DIEU_CHINH' | 'KHONG_THONG_QUA'

export default class ProjectOutlineDefenseSession extends BaseModel {
  static table = 'project_outline_defense_sessions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare status: DefenseSessionStatus

  @column()
  declare meetingMode: DefenseMeetingMode

  @column.dateTime()
  declare meetingAt: DateTime

  @column()
  declare location: string | null

  @column()
  declare meetingUrl: string | null

  @column()
  declare shortNoticeOverride: boolean

  @column()
  declare shortNoticeReason: string | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column()
  declare cancelReason: string | null

  @column()
  declare discussionNotes: string | null

  @column()
  declare conclusion: DefenseConclusion | null

  @column()
  declare finalScore: number | null

  @column()
  declare adjustmentRequirements: string | null

  @column.dateTime()
  declare adjustmentDeadline: DateTime | null

  @column()
  declare minutesHtml: string | null

  @column()
  declare minutesFileUrl: string | null

  @column.dateTime()
  declare finalizedAt: DateTime | null

  @column()
  declare finalizedBy: number | null

  @column()
  declare createdBy: number

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare projectOutline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => ProjectOutlineDefenseMember, { foreignKey: 'sessionId' })
  declare members: HasMany<typeof ProjectOutlineDefenseMember>
}
