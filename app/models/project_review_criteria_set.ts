import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ProjectReviewCriteriaItem from '#models/project_review_criteria_item'

export default class ProjectReviewCriteriaSet extends BaseModel {
  static table = 'project_review_criteria_sets'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column()
  declare isDefault: boolean

  @column()
  declare failThreshold: number

  @column()
  declare blindAggregation: boolean

  @column()
  declare minCommentLength: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => ProjectReviewCriteriaItem, { foreignKey: 'criteriaSetId' })
  declare items: HasMany<typeof ProjectReviewCriteriaItem>
}
