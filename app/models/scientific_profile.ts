import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProfileLanguage from '#models/profile_language'
import ProfileAttachment from '#models/profile_attachment'
import Publication from '#models/publication'
import ProfileVerifyLog from '#models/profile_verify_log'
import PublicationAuthor from '#models/publication_author'
import KpiResult from '#models/kpi_result'

/** Status hồ sơ */
export type ProfileStatus = 'DRAFT' | 'UPDATED' | 'VERIFIED' | 'NEED_MORE_INFO'

/**
 * Hồ sơ khoa học (1 user - 1 profile).
 */
export default class ScientificProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare fullName: string

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare gender: string | null

  @column()
  declare workEmail: string

  @column()
  declare phone: string | null

  @column()
  declare orcid: string | null

  @column()
  declare googleScholarUrl: string | null

  @column()
  declare scopusId: string | null

  @column()
  declare researchGateUrl: string | null

  @column()
  declare personalWebsite: string | null

  @column()
  declare avatarUrl: string | null

  @column()
  declare bio: string | null

  @column()
  declare organization: string

  @column()
  declare faculty: string | null

  @column()
  declare department: string | null

  @column()
  declare currentTitle: string | null

  @column()
  declare managementRole: string | null

  @column.date()
  declare startWorkingAt: DateTime | null

  @column()
  declare degree: string | null

  @column()
  declare academicTitle: string | null

  @column()
  declare degreeYear: number | null

  @column()
  declare degreeInstitution: string | null

  @column()
  declare degreeCountry: string | null

  @column()
  declare mainResearchArea: string | null

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => (typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []),
  })
  declare subResearchAreas: string[]

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => (typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []),
  })
  declare keywords: string[]

  @column()
  declare status: ProfileStatus

  @column()
  declare completeness: number

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column()
  declare verifiedBy: string | null

  @column()
  declare needMoreInfoReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @hasMany(() => ProfileLanguage, { foreignKey: 'profileId' })
  declare languages: HasMany<typeof ProfileLanguage>

  @hasMany(() => ProfileAttachment, { foreignKey: 'profileId' })
  declare attachments: HasMany<typeof ProfileAttachment>

  @hasMany(() => Publication, { foreignKey: 'profileId' })
  declare publications: HasMany<typeof Publication>

  @hasMany(() => ProfileVerifyLog, { foreignKey: 'profileId' })
  declare verifyLogs: HasMany<typeof ProfileVerifyLog>

  @hasMany(() => PublicationAuthor, { foreignKey: 'profileId' })
  declare publicationAuthors: HasMany<typeof PublicationAuthor>

  @hasMany(() => KpiResult, { foreignKey: 'profileId' })
  declare kpiResults: HasMany<typeof KpiResult>

  /**
   * Tính điểm đầy đủ hồ sơ (0-100).
   */
  static calculateCompleteness(profile: {
    fullName?: string | null
    workEmail?: string | null
    organization?: string | null
    faculty?: string | null
    degree?: string | null
    mainResearchArea?: string | null
    bio?: string | null
    phone?: string | null
    orcid?: string | null
    googleScholarUrl?: string | null
    languages?: { length: number } | null
    publications?: { length: number } | null
  }): number {
    let score = 0
    const checks: Array<{ field: keyof typeof profile; weight: number }> = [
      { field: 'fullName', weight: 10 },
      { field: 'workEmail', weight: 10 },
      { field: 'organization', weight: 10 },
      { field: 'faculty', weight: 5 },
      { field: 'degree', weight: 10 },
      { field: 'mainResearchArea', weight: 10 },
      { field: 'bio', weight: 5 },
      { field: 'phone', weight: 5 },
      { field: 'orcid', weight: 5 },
      { field: 'googleScholarUrl', weight: 5 },
    ]
    checks.forEach(({ field, weight }) => {
      const val = profile[field]
      if (val !== undefined && val !== null && (typeof val !== 'string' || val.trim() !== '')) score += weight
    })
    if (profile.languages && profile.languages.length > 0) score += 10
    if (profile.publications && profile.publications.length > 0) score += 10
    return Math.min(score, 100)
  }
}
