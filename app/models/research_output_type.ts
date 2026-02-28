import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import ResearchOutputRule from '#models/research_output_rule'

/**
 * Loại kết quả NCKH trong cây phân cấp 2–3 cấp.
 * Level 1: parent_id null. Level 2–3: parent_id not null.
 */
export default class ResearchOutputType extends BaseModel {
  static table = 'research_output_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare parentId: number | null

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare level: number

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ResearchOutputType, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof ResearchOutputType>

  @hasMany(() => ResearchOutputType, { foreignKey: 'parentId' })
  declare children: HasMany<typeof ResearchOutputType>

  @hasOne(() => ResearchOutputRule, { foreignKey: 'typeId' })
  declare rule: HasOne<typeof ResearchOutputRule>

  /** True nếu node không có con (leaf). */
  async isLeaf(): Promise<boolean> {
    const row = await ResearchOutputType.query()
      .where('parent_id', this.id)
      .count('*', 'total')
      .first()
    const total = Number((row as { $extras?: { total?: string } } | null)?.$extras?.total ?? 0)
    return total === 0
  }

  /** Chỉ leaf node mới được gắn rule. */
  async canHaveRule(): Promise<boolean> {
    return this.isLeaf()
  }
}
