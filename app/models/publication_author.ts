import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'

/** Loại affiliation tác giả */
export type AffiliationType = 'UDN_ONLY' | 'MIXED' | 'OUTSIDE'

/**
 * Tác giả bài báo: liên kết publication – profile, thứ tự, vai trò, affiliation.
 * Phục vụ tính giờ NCKH theo QĐ 1883.
 */
export default class PublicationAuthor extends BaseModel {
  static table = 'publication_authors'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare publicationId: number

  @column()
  declare profileId: number | null

  @column()
  declare fullName: string

  @column()
  declare authorOrder: number

  @column()
  declare isMainAuthor: boolean

  @column()
  declare isCorresponding: boolean

  @column()
  declare affiliationType: AffiliationType

  @column()
  declare isMultiAffiliationOutsideUdn: boolean

  @column()
  declare contributionPercent: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Publication, { foreignKey: 'publicationId' })
  declare publication: BelongsTo<typeof Publication>

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>
}
