import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ProjectOutlineDefenseSessionOutline from '#models/project_outline_defense_session_outline'
import ProjectOutlineDefenseScoreSheet from '#models/project_outline_defense_score_sheet'
import User from '#models/user'

/** DRAFT → PENDING_BGH → BGH_SIGNED → PUBLISHED → FINALIZED | CANCELLED */
export type DefenseSessionStatus =
  | 'DRAFT'
  | 'PENDING_BGH'
  | 'BGH_SIGNED'
  | 'PUBLISHED'
  | 'CONFIRMED' // legacy = PUBLISHED
  | 'CANCELLED'
  | 'FINALIZED'

export type DefenseMeetingMode = 'IN_PERSON' | 'ONLINE' | 'HYBRID'
export type DefenseConclusion = 'THONG_QUA' | 'THONG_QUA_DIEU_CHINH' | 'KHONG_THONG_QUA'

export default class ProjectOutlineDefenseSession extends BaseModel {
  static table = 'project_outline_defense_sessions'

  @column({ isPrimary: true })
  declare id: number

  /** TM chính (TM đầu tiên) — giữ FK cũ */
  @column()
  declare projectOutlineId: number

  @column()
  declare title: string | null

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

  /** PKH xác nhận họp sớm hơn lịch — mở biên bản cho Thư ký */
  @column()
  declare earlyMeetingOpened: boolean

  @column.dateTime()
  declare earlyMeetingOpenedAt: DateTime | null

  @column()
  declare earlyMeetingOpenedBy: number | null

  @column()
  declare decisionDraftHtml: string | null

  @column()
  declare decisionCode: string | null

  @column()
  declare decisionFileUrl: string | null

  @column.dateTime()
  declare submittedToBghAt: DateTime | null

  @column()
  declare submittedToBghBy: number | null

  @column.dateTime()
  declare bghSignedAt: DateTime | null

  @column()
  declare bghSignedBy: number | null

  @column()
  declare bghSignNote: string | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column()
  declare publishedBy: number | null

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

  @column()
  declare totalBallots: number | null

  @column()
  declare validBallots: number | null

  @column()
  declare invalidBallots: number | null

  /** Mục 6 — Kiến nghị trên mẫu biên bản */
  @column()
  declare recommendations: string | null

  @column()
  declare minutesLockedReason: string | null

  @column.dateTime()
  declare minutesReopenedAt: DateTime | null

  @column()
  declare minutesReopenedBy: number | null

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

  @hasMany(() => ProjectOutlineDefenseSessionOutline, { foreignKey: 'sessionId' })
  declare sessionOutlines: HasMany<typeof ProjectOutlineDefenseSessionOutline>

  @hasMany(() => ProjectOutlineDefenseScoreSheet, { foreignKey: 'sessionId' })
  declare scoreSheets: HasMany<typeof ProjectOutlineDefenseScoreSheet>
}
