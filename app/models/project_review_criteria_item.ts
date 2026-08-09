import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ProjectReviewCriteriaSet from '#models/project_review_criteria_set'

export default class ProjectReviewCriteriaItem extends BaseModel {
  static table = 'project_review_criteria_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare criteriaSetId: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare maxScore: number

  @column()
  declare weight: number

  @column()
  declare sortOrder: number

  @column()
  declare commentRequired: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectReviewCriteriaSet, { foreignKey: 'criteriaSetId' })
  declare criteriaSet: BelongsTo<typeof ProjectReviewCriteriaSet>
}
