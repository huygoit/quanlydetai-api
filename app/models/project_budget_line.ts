import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { BudgetLineCode } from '#constants/module56'

/** 10 mục chi BM.06 của nhiệm vụ đang triển khai. */
export default class ProjectBudgetLine extends BaseModel {
  static table = 'project_budget_lines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare code: BudgetLineCode

  @column()
  declare amount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
