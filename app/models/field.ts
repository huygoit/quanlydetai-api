import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Trạng thái lĩnh vực */
export type FieldStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Danh mục lĩnh vực khoa học (field): phẳng.
 */
export default class Field extends BaseModel {
  static table = 'fields'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare displayOrder: number

  @column()
  declare status: FieldStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
