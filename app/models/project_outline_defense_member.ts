import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import User from '#models/user'

export type DefenseCouncilRole = 'CHU_TICH' | 'THU_KY' | 'UY_VIEN'
export type DefenseAttendance = 'PENDING' | 'PRESENT' | 'ABSENT'

export default class ProjectOutlineDefenseMember extends BaseModel {
  static table = 'project_outline_defense_members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare userId: number | null

  @column()
  declare scientificProfileId: number | null

  @column()
  declare memberName: string

  @column()
  declare memberEmail: string | null

  @column()
  declare roleInCouncil: DefenseCouncilRole

  @column()
  declare isExternal: boolean

  @column()
  declare unit: string | null

  @column()
  declare proposedSourceNote: string | null

  @column()
  declare attendance: DefenseAttendance | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutlineDefenseSession, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof ProjectOutlineDefenseSession>

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}
