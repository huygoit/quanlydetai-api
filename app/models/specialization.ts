import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Trạng thái chuyên ngành */
export type SpecializationStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Danh mục chuyên ngành (specialization): phẳng.
 */
export default class Specialization extends BaseModel {
  static table = 'specializations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare displayOrder: number

  @column()
  declare status: SpecializationStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
