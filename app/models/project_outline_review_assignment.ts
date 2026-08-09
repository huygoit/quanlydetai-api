import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import User from '#models/user'

export type OutlineReviewAssignmentStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'COMPLETED'

export default class ProjectOutlineReviewAssignment extends BaseModel {
  static table = 'project_outline_review_assignments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare reviewerUserId: number | null

  @column()
  declare scientificProfileId: number | null

  @column()
  declare reviewerName: string

  @column()
  declare reviewerEmail: string | null

  @column()
  declare isExternal: boolean

  @column()
  declare status: OutlineReviewAssignmentStatus

  @column.dateTime()
  declare deadlineAt: DateTime

  @column()
  declare assignedBy: number | null

  @column.dateTime()
  declare assignedAt: DateTime

  @column()
  declare expertiseExceptionReason: string | null

  @column()
  declare workloadOverrideReason: string | null

  @column()
  declare cancelReason: string | null

  @column()
  declare cancelledBy: number | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column()
  declare replacedByAssignmentId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare projectOutline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => User, { foreignKey: 'reviewerUserId' })
  declare reviewerUser: BelongsTo<typeof User>
}
