import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'

export default class ProjectProgressPeriod extends BaseModel {
  static table = 'project_progress_periods'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare title: string

  @column.date()
  declare dueOn: DateTime

  @column()
  declare kind: 'MILESTONE' | 'MIDPOINT'

  @column()
  declare sourceIndex: number | null

  @column(jsonAttr<number[]>([]))
  declare remindedDays: number[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
