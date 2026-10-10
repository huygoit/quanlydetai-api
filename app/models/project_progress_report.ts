import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'
import type { BctdStatus } from '#constants/module56'

export type ProgressContentRow = { milestone: string; progress: string; done: string }
export type ProgressProductRow = { name: string; planned: string; achieved: string }
export type StoredFile = { fileName: string; fileUrl: string; fileSize: number | null }

export default class ProjectProgressReport extends BaseModel {
  static table = 'project_progress_reports'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare periodId: number

  @column()
  declare projectOutlineId: number

  @column()
  declare status: BctdStatus

  @column(jsonAttr<ProgressContentRow[]>([]))
  declare contentRows: ProgressContentRow[]

  @column(jsonAttr<ProgressProductRow[]>([]))
  declare productRows: ProgressProductRow[]

  @column()
  declare nextPlan: string | null

  @column()
  declare recommendation: string | null

  @column(jsonAttr<StoredFile[]>([]))
  declare attachments: StoredFile[]

  @column()
  declare version: number

  @column()
  declare pkhNote: string | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
