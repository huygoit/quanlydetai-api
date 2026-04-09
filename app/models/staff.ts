import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Department from '#models/department'
import User from '#models/user'

/**
 * Danh mục nhân sự (bảng staffs) — import DMNHanSu.
 */
export default class Staff extends BaseModel {
  static table = 'staffs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare staffCode: string

  @column()
  declare fullName: string

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare gender: string | null

  @column()
  declare maritalStatus: string | null

  @column()
  declare religionOrEthnicity: string | null

  @column()
  declare priorityGroup: string | null

  @column()
  declare identityNumber: string | null

  @column()
  declare identityIssuePlace: string | null

  @column.date()
  declare identityIssueDate: DateTime | null

  @column()
  declare insuranceNumber: string | null

  @column()
  declare hometown: string | null

  @column()
  declare placeOfBirth: string | null

  @column()
  declare permanentAddress: string | null

  @column()
  declare currentAddress: string | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column()
  declare departmentName: string | null

  @column()
  declare departmentCode: string | null

  @column()
  declare departmentId: number | null

  @column.date()
  declare hiredAt: DateTime | null

  @column.date()
  declare rankedAt: DateTime | null

  @column()
  declare receivingAgency: string | null

  @column()
  declare recruitmentWorkType: string | null

  @column()
  declare staffType: string | null

  @column()
  declare currentJob: string | null

  @column()
  declare socialInsuranceLeave: string | null

  @column()
  declare positionTitle: string | null

  @column.date()
  declare appointedAt: DateTime | null

  @column()
  declare concurrentPosition: string | null

  @column()
  declare highestPosition: string | null

  @column()
  declare partyJoinedAtRaw: string | null

  @column()
  declare partyPosition: string | null

  @column()
  declare isUnionMember: boolean | null

  @column()
  declare professionalDegree: string | null

  @column()
  declare industryGroup: string | null

  @column()
  declare field: string | null

  @column()
  declare major: string | null

  @column()
  declare professionalTitle: string | null

  @column()
  declare trainingPlace: string | null

  @column()
  declare trainingMode: string | null

  @column()
  declare trainingCountry: string | null

  @column()
  declare trainingInstitution: string | null

  @column()
  declare graduationYear: number | null

  @column()
  declare politicalLevel: string | null

  @column()
  declare stateManagementLevel: string | null

  @column()
  declare itLevel: string | null

  @column()
  declare titleAward: string | null

  @column()
  declare recognitionYear: number | null

  @column()
  declare academicTitle: string | null

  @column()
  declare is85Program: boolean | null

  @column()
  declare jobTitleType: string | null

  @column()
  declare salaryStep: number | null

  @column()
  declare salaryCoefficient: string | null

  @column()
  declare userId: number | null

  @column()
  declare note: string | null

  @column()
  declare sourceData: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Department)
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
