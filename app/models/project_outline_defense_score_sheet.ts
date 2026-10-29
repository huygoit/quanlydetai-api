import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ProjectOutline from '#models/project_outline'

export type DefenseScoreLine = {
  code: string
  name: string
  maxScore: number
  score: number | null
}

/** Phiếu BM.05a — thành viên HĐ × thuyết minh */
export default class ProjectOutlineDefenseScoreSheet extends BaseModel {
  static table = 'project_outline_defense_score_sheets'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare memberId: number

  @column()
  declare projectOutlineId: number

  @column()
  declare status: 'DRAFT' | 'SUBMITTED'

  @column()
  declare precheckEligible: boolean | null

  @column()
  declare precheckConflictCleared: boolean | null

  @column()
  declare precheckEthicsOk: boolean | null

  @column({
    prepare: (v: DefenseScoreLine[] | null) => JSON.stringify(v ?? []),
    consume: (v: string | unknown) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return []
        }
      }
      return v ?? []
    },
    serializeAs: 'scores',
  })
  declare scoresJson: DefenseScoreLine[]

  @column()
  declare totalScore: number | null

  @column()
  declare conclusion: string | null

  @column()
  declare generalComment: string | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime()
  declare remindedAt: DateTime | null

  @column()
  declare remindedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineDefenseSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProjectOutlineDefenseSession>

  @belongsTo(() => ProjectOutlineDefenseMember, { foreignKey: 'memberId' })
  declare member: BelongsTo<typeof ProjectOutlineDefenseMember>

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>
}
