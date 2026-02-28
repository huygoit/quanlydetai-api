import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ScientificProfile from '#models/scientific_profile'

export default class ProfileLanguage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare profileId: number

  @column()
  declare language: string

  @column()
  declare level: string | null

  @column()
  declare certificate: string | null

  @column()
  declare certificateUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>
}
