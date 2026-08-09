import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'

export type OutlineBudgetGroup = 'NHAN_CONG' | 'VAT_TU' | 'HOI_THAO' | 'KHAC'

export default class ProjectOutlineBudgetLine extends BaseModel {
  static table = 'project_outline_budget_lines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare groupCode: OutlineBudgetGroup

  @column()
  declare content: string

  @column()
  declare amount: number

  @column()
  declare note: string | null

  @column()
  declare lineOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare projectOutline: BelongsTo<typeof ProjectOutline>
}
