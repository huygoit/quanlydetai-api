import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ResearchOutputType from '#models/research_output_type'

/** Các loại rule quy đổi (validate trong code). */
export type RuleKind =
  | 'FIXED'
  | 'MULTIPLY_A'
  | 'HDGSNN_POINTS_TO_HOURS'
  | 'MULTIPLY_C'
  | 'RANGE_REVENUE'
  | 'BONUS_ADD'

/**
 * Rule quy đổi CANONICAL: bảng research_output_rules, gắn theo type_id (leaf).
 * Mỗi leaf type tối đa một rule.
 */
export default class ResearchOutputRule extends BaseModel {
  static table = 'research_output_rules'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare typeId: number

  @column()
  declare ruleKind: string

  @column()
  declare pointsValue: number | null

  @column()
  declare hoursValue: number | null

  @column()
  declare hoursMultiplierVar: string | null

  @column()
  declare hoursBonus: number | null

  @column()
  declare meta: Record<string, unknown>

  @column()
  declare evidenceRequirements: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ResearchOutputType, { foreignKey: 'typeId' })
  declare type: BelongsTo<typeof ResearchOutputType>

  /** Base hours (B0) cho engine: từ hoursValue khi ruleKind FIXED/MULTIPLY_A. */
  get baseHours(): number | null {
    return this.hoursValue
  }
}
