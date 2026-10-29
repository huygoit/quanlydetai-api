import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutline from '#models/project_outline'

/** Kết luận HĐ theo mẫu biên bản BM-02.10 */
export type CouncilMinutesConclusion =
  | 'DE_XUAT_XET'
  | 'GIAO_TRUC_TIEP'
  | 'HOAN_THIEN'
  | 'KHONG_DE_XUAT'

export default class ProjectOutlineDefenseMinutesItem extends BaseModel {
  static table = 'project_outline_defense_minutes_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare projectOutlineId: number

  @column()
  declare averageScore: number | null

  @column()
  declare validSheetCount: number

  @column()
  declare invalidSheetCount: number

  @column()
  declare councilConclusion: CouncilMinutesConclusion | null

  @column()
  declare executionContent: string | null

  @column()
  declare adjustmentRequirements: string | null

  @column.dateTime()
  declare adjustmentDeadline: DateTime | null

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineDefenseSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProjectOutlineDefenseSession>

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>
}
