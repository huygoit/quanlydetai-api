import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import StartupProject from '#models/startup_project'
import Student from '#models/student'
import Lecturer from '#models/lecturer'

export type StartupProjectMemberType = 'STUDENT' | 'LECTURER'
export type StartupProjectMemberRole = 'LEADER' | 'MENTOR' | 'MEMBER'

export default class StartupProjectMember extends BaseModel {
  static table = 'startup_project_members'

  static readonly TYPE_STUDENT: StartupProjectMemberType = 'STUDENT'
  static readonly TYPE_LECTURER: StartupProjectMemberType = 'LECTURER'
  static readonly ROLE_LEADER: StartupProjectMemberRole = 'LEADER'
  static readonly ROLE_MENTOR: StartupProjectMemberRole = 'MENTOR'
  static readonly ROLE_MEMBER: StartupProjectMemberRole = 'MEMBER'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare startupProjectId: number

  @column()
  declare memberType: StartupProjectMemberType

  @column()
  declare studentId: number | null

  @column()
  declare lecturerId: number | null

  @column()
  declare role: StartupProjectMemberRole

  @column()
  declare isMain: boolean

  @column.date()
  declare joinedAt: DateTime | null

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => StartupProject, { foreignKey: 'startupProjectId' })
  declare startupProject: BelongsTo<typeof StartupProject>

  @belongsTo(() => Student, { foreignKey: 'studentId' })
  declare student: BelongsTo<typeof Student>

  @belongsTo(() => Lecturer, { foreignKey: 'lecturerId' })
  declare lecturer: BelongsTo<typeof Lecturer>
}
