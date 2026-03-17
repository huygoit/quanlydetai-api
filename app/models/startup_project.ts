import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ResearchStartupField from '#models/research_startup_field'
import AcademicYear from '#models/academic_year'
import Faculty from '#models/faculty'
import Department from '#models/department'
import Student from '#models/student'
import Lecturer from '#models/lecturer'
import StartupProjectMember from '#models/startup_project_member'

export type StartupProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWARDED'
  | 'REJECTED'
  | 'CANCELLED'

export type StartupProductStage = 'IDEA' | 'MVP' | 'PILOT' | 'MARKET'

export default class StartupProject extends BaseModel {
  static table = 'startup_projects'

  static readonly STATUSES: StartupProjectStatus[] = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'AWARDED',
    'REJECTED',
    'CANCELLED',
  ]

  static readonly PRODUCT_STAGES: StartupProductStage[] = ['IDEA', 'MVP', 'PILOT', 'MARKET']

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare researchStartupFieldId: number | null

  @column()
  declare academicYearId: number | null

  @column()
  declare facultyId: number | null

  @column()
  declare departmentId: number | null

  @column()
  declare leaderStudentId: number | null

  @column()
  declare mentorLecturerId: number | null

  @column()
  declare status: StartupProjectStatus

  @column()
  declare problemStatement: string | null

  @column()
  declare solutionDescription: string | null

  @column()
  declare businessModel: string | null

  @column()
  declare targetCustomer: string | null

  @column()
  declare productStage: StartupProductStage | null

  @column()
  declare achievement: string | null

  @column()
  declare awardInfo: string | null

  @column()
  declare note: string | null

  @column.date()
  declare startedAt: DateTime | null

  @column.date()
  declare endedAt: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  @belongsTo(() => ResearchStartupField, { foreignKey: 'researchStartupFieldId' })
  declare field: BelongsTo<typeof ResearchStartupField>

  @belongsTo(() => AcademicYear, { foreignKey: 'academicYearId' })
  declare academicYear: BelongsTo<typeof AcademicYear>

  @belongsTo(() => Faculty, { foreignKey: 'facultyId' })
  declare faculty: BelongsTo<typeof Faculty>

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => Student, { foreignKey: 'leaderStudentId' })
  declare leaderStudent: BelongsTo<typeof Student>

  @belongsTo(() => Lecturer, { foreignKey: 'mentorLecturerId' })
  declare mentorLecturer: BelongsTo<typeof Lecturer>

  @hasMany(() => StartupProjectMember, { foreignKey: 'startupProjectId' })
  declare members: HasMany<typeof StartupProjectMember>
}
