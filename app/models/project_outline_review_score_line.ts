import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ProjectOutlineReviewScoreSheet from '#models/project_outline_review_score_sheet'

export default class ProjectOutlineReviewScoreLine extends BaseModel {
  static table = 'project_outline_review_score_lines'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare scoreSheetId: number

  @column()
  declare criterionCode: string

  @column()
  declare criterionName: string

  @column()
  declare maxScore: number

  @column()
  declare weight: number

  @column()
  declare sortOrder: number

  @column()
  declare commentRequired: boolean

  @column()
  declare score: number | null

  @column()
  declare comment: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineReviewScoreSheet, { foreignKey: 'scoreSheetId' })
  declare scoreSheet: BelongsTo<typeof ProjectOutlineReviewScoreSheet>
}
