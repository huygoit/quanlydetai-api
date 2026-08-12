import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { StaffPositionKind } from '#types/staff_position'

/** Trạng thái danh mục chức vụ */
export type StaffPositionStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Danh mục chức vụ (staff_positions): phẳng, phân loại theo kind.
 */
export default class StaffPosition extends BaseModel {
  static table = 'staff_positions'

  @column({ isPrimary: true })
  declare id: number

  /** MAIN | CONCURRENT | HIGHEST | PARTY */
  @column()
  declare kind: StaffPositionKind

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare displayOrder: number

  @column()
  declare status: StaffPositionStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
