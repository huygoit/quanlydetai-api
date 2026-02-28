import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ScientificProfile from '#models/scientific_profile'

export type AttachmentType = 'CV_PDF' | 'DEGREE' | 'CERTIFICATE' | 'OTHER'

export default class ProfileAttachment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare profileId: number

  @column()
  declare type: AttachmentType

  @column()
  declare name: string

  @column()
  declare url: string

  @column.dateTime()
  declare uploadedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>
}
