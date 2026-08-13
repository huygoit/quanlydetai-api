import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type CountryStatus = 'ACTIVE' | 'INACTIVE'

/** Danh mục quốc gia. */
export default class Country extends BaseModel {
  static table = 'countries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare displayOrder: number

  @column()
  declare status: CountryStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
