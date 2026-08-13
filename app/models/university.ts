import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type {
  UniversityRegion,
  UniversitySchoolBlock,
  UniversityStatus,
} from '#types/university'

/** Danh mục trường đại học / học viện Việt Nam. */
export default class University extends BaseModel {
  static table = 'universities'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare region: UniversityRegion

  @column()
  declare schoolBlock: UniversitySchoolBlock

  /** FK danh mục quốc gia — mặc định Việt Nam khi seed/tạo mới. */
  @column()
  declare countryId: number | null

  @column()
  declare isPrivate: boolean

  @column()
  declare displayOrder: number

  @column()
  declare status: UniversityStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
