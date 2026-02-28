import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ScientificProfile from '#models/scientific_profile'
import PublicationAuthor from '#models/publication_author'

export default class Publication extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare profileId: number

  @column()
  declare title: string

  @column()
  declare authors: string

  @column()
  declare correspondingAuthor: string | null

  @column()
  declare myRole: string | null

  @column()
  declare publicationType: string

  @column()
  declare journalOrConference: string

  @column()
  declare year: number | null

  @column()
  declare volume: string | null

  @column()
  declare issue: string | null

  @column()
  declare pages: string | null

  @column()
  declare rank: string | null

  @column()
  declare quartile: string | null

  @column()
  declare doi: string | null

  @column()
  declare issn: string | null

  @column()
  declare isbn: string | null

  @column()
  declare url: string | null

  @column()
  declare publicationStatus: string

  @column()
  declare academicYear: string | null

  @column()
  declare source: string

  @column()
  declare sourceId: string | null

  @column()
  declare verifiedByNcv: boolean

  @column()
  declare approvedInternal: boolean | null

  @column()
  declare attachmentUrl: string | null

  /** Loại quy đổi cho bài DOMESTIC/OTHER: HDGSNN_SCORE hoặc CONFERENCE_ISBN */
  @column()
  declare domesticRuleType: string | null

  /** Điểm HDGSNN (bắt buộc khi domestic_rule_type = HDGSNN_SCORE) */
  @column()
  declare hdgsnnScore: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>

  /** Danh sách tác giả (bảng publication_authors). Tránh trùng tên với cột authors (string). */
  @hasMany(() => PublicationAuthor, { foreignKey: 'publicationId' })
  declare publicationAuthors: HasMany<typeof PublicationAuthor>
}
