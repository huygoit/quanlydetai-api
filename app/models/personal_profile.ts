import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Department from '#models/department'

export type PersonalProfileStatus = 'ACTIVE' | 'INACTIVE'
export type PersonalProfileGender = 'MALE' | 'FEMALE' | 'OTHER'

/**
 * Hồ sơ cá nhân - thông tin nhân sự nền của cán bộ/giảng viên.
 */
export default class PersonalProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare staffCode: string | null

  @column()
  declare fullName: string

  @column()
  declare gender: PersonalProfileGender | null

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare placeOfBirth: string | null

  @column()
  declare phone: string | null

  @column()
  declare personalEmail: string | null

  @column()
  declare workEmail: string | null

  @column()
  declare address: string | null

  @column()
  declare departmentId: number | null

  @column()
  declare positionTitle: string | null

  @column()
  declare employmentType: string | null

  @column()
  declare academicDegree: string | null

  @column()
  declare academicTitle: string | null

  @column()
  declare specialization: string | null

  @column()
  declare professionalQualification: string | null

  @column()
  declare identityNumber: string | null

  @column.date()
  declare identityIssueDate: DateTime | null

  @column()
  declare identityIssuePlace: string | null

  @column()
  declare status: PersonalProfileStatus

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Department)
  declare department: BelongsTo<typeof Department>
}
