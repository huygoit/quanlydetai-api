import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Department from '#models/department'

/**
 * Sinh viên - import từ Excel (sheet SinhVien, map đơn vị qua DonVi_Nganh).
 */
export default class Student extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentCode: string

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare fullName: string | null

  @column()
  declare gender: string | null

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare placeOfBirth: string | null

  @column()
  declare classCode: string | null

  @column()
  declare className: string | null

  @column()
  declare courseName: string | null

  @column()
  declare status: string | null

  @column()
  declare majorCodeRaw: string | null

  @column()
  declare majorName: string | null

  @column()
  declare departmentId: number | null

  @column()
  declare personalEmail: string | null

  @column()
  declare schoolEmail: string | null

  @column()
  declare phone: string | null

  @column()
  declare identityCardNumber: string | null

  @column()
  declare identityCardIssuePlace: string | null

  @column.date()
  declare identityCardIssueDate: DateTime | null

  @column()
  declare ethnicity: string | null

  @column()
  declare permanentAddress: string | null

  @column()
  declare contactAddress: string | null

  @column()
  declare temporaryAddress: string | null

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
}
