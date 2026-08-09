import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectOutlineReviewScoreLine from '#models/project_outline_review_score_line'

export type ScoreSheetStatus = 'DRAFT' | 'SUBMITTED'

export type CriteriaSnapshotItem = {
  code: string
  name: string
  description?: string | null
  maxScore: number
  weight: number
  sortOrder: number
  commentRequired: boolean
}

export type CriteriaSnapshot = {
  setId: number
  setCode: string
  setName: string
  failThreshold: number
  blindAggregation: boolean
  minCommentLength: number
  items: CriteriaSnapshotItem[]
}

export default class ProjectOutlineReviewScoreSheet extends BaseModel {
  static table = 'project_outline_review_score_sheets'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare assignmentId: number

  @column()
  declare projectOutlineId: number

  @column()
  declare criteriaSetId: number | null

  @column({
    prepare: (v: CriteriaSnapshot | null) => (v == null ? '{}' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return null
        }
      }
      return v
    },
  })
  declare criteriaSnapshot: CriteriaSnapshot

  @column()
  declare status: ScoreSheetStatus

  @column()
  declare totalScore: number | null

  @column()
  declare generalComment: string | null

  @column()
  declare conclusion: string | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime()
  declare reopenedAt: DateTime | null

  @column()
  declare reopenedBy: number | null

  @column()
  declare reopenReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineReviewAssignment, { foreignKey: 'assignmentId' })
  declare assignment: BelongsTo<typeof ProjectOutlineReviewAssignment>

  @hasMany(() => ProjectOutlineReviewScoreLine, { foreignKey: 'scoreSheetId' })
  declare lines: HasMany<typeof ProjectOutlineReviewScoreLine>
}
