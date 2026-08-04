import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Trạng thái loại quy trình đề tài */
export type ProjectProcessTypeStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Danh mục loại quy trình đề tài (QT-I … QT-V).
 */
export default class ProjectProcessType extends BaseModel {
  static table = 'project_process_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare displayOrder: number

  @column()
  declare status: ProjectProcessTypeStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
