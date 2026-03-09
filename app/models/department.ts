import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Loại đơn vị */
export type DepartmentType =
  | 'UNIVERSITY'
  | 'BOARD'
  | 'OFFICE'
  | 'FACULTY'
  | 'CENTER'
  | 'COUNCIL'
  | 'OTHER'

/** Trạng thái đơn vị */
export type DepartmentStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Danh mục đơn vị (department): phẳng, có type phân loại.
 */
export default class Department extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare shortName: string | null

  @column()
  declare type: DepartmentType

  @column()
  declare displayOrder: number

  @column()
  declare status: DepartmentStatus

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static get table() {
    return 'departments'
  }
}
