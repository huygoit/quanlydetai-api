import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type BudgetEntryType = 'ADVANCE' | 'SPENT' | 'SETTLED'
export type BudgetSourceType = 'YCKT' | 'MS' | 'QT'

/** Một dòng sổ kinh phí. Số hiển thị chỉ cộng từ bảng này. */
export default class ProjectBudgetEntry extends BaseModel {
  static table = 'project_budget_entries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare lineCode: string

  @column()
  declare entryType: BudgetEntryType

  @column()
  declare amount: number

  @column()
  declare sourceType: BudgetSourceType

  @column()
  declare sourceId: number

  @column()
  declare note: string | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
