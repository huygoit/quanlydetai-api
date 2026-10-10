import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'
import type { DcStatus } from '#constants/module56'
import type { OutlineMilestone } from '#models/project_outline'

export type AdjustmentBudgetLine = { code: string; amount: number }

export type AdjustmentChanges = {
  endDate?: string | null
  principalUserId?: number | null
  content?: string | null
  milestones?: OutlineMilestone[] | null
  budgetLines?: AdjustmentBudgetLine[] | null
}

export default class ProjectAdjustment extends BaseModel {
  static table = 'project_adjustments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare status: DcStatus

  @column()
  declare reason: string

  @column()
  declare evidenceUrl: string | null

  @column(jsonAttr<AdjustmentChanges>({}))
  declare changes: AdjustmentChanges

  @column()
  declare leadConfirmed: boolean

  @column()
  declare leadConfirmedBy: number | null

  @column()
  declare decisionNote: string | null

  @column(jsonAttr<Record<string, unknown> | null>(null))
  declare appliedDiff: Record<string, unknown> | null

  @column()
  declare appendixFileUrl: string | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
