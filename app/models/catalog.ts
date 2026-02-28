import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * Danh mục dùng chung: FIELD, UNIT, PROJECT_LEVEL, LANGUAGE, ...
 */
export default class Catalog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: string

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column()
  declare parentId: number | null

  @column({
    prepare: (value: object | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: string | Record<string, unknown> | null) =>
      value === null ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Catalog, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof Catalog>
}
