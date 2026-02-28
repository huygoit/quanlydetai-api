import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ScientificProfile from '#models/scientific_profile'

/**
 * Cache KPI theo profile + năm học: tổng giờ NCKH, đạt định mức, chi tiết (jsonb).
 */
export default class KpiResult extends BaseModel {
  static table = 'kpi_results'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare profileId: number

  @column()
  declare academicYear: string

  @column()
  declare totalHours: number

  @column()
  declare metQuota: boolean

  @column({
    prepare: (v: object | null) => (v == null ? '{}' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : typeof v === 'object' && v !== null ? v : {},
  })
  declare detail: Record<string, unknown>

  @column.dateTime()
  declare createdAt: DateTime | null

  @column.dateTime()
  declare updatedAt: DateTime | null

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>
}
