import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Department from '#models/department'
import Field from '#models/field'
import Specialization from '#models/specialization'
import type { UdnAffiliationUnitKey } from '#constants/udn_affiliation_units'
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

  /** Key trong UDN_AFFILIATION_UNITS (cơ quan công tác cấp trường ĐHĐN). */
  @column()
  declare organizationId: UdnAffiliationUnitKey | null

  @column()
  declare faculty: string | null

  /** FK departments — khoa / phòng / ban. */
  @column()
  declare departmentId: number | null

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

  /** Năm công nhận học hàm (PGS/GS). */
  @column()
  declare academicTitleYear: number | null

  /** Chuyên ngành gắn với học hàm (vd. công nhận GS ở Pháp). */
  @column()
  declare academicTitleMajor: string | null

  /** Quốc gia công nhận học hàm. */
  @column()
  declare academicTitleCountry: string | null

  @column()
  declare degreeYear: number | null

  @column()
  declare degreeInstitution: string | null

  @column()
  declare degreeCountry: string | null

  /** Chuyên ngành gắn với học vị (Thạc sĩ / Tiến sĩ…). */
  @column()
  declare degreeMajor: string | null

  /** Tốt nghiệp đại học — tên trường / cơ sở. */
  @column()
  declare undergraduateInstitution: string | null

  @column()
  declare undergraduateYear: number | null

  @column()
  declare undergraduateMajor: string | null

  @column()
  declare undergraduateCountry: string | null

  /**
   * Quá trình giảng dạy & công tác (nhiều dòng).
   * JSON: [{ id, fromMonth, fromYear, toMonth, toYear, isCurrent, role, organization, country, note }]
   */
  @column({
    prepare: (v: unknown[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare teachingWorkRecords: Record<string, unknown>[]

  /**
   * Quá trình đào tạo theo bậc (Đại học, Thạc sĩ, NCS…).
   * JSON: [{ id, level, major, institution, country, startYear, endYear, trainingForm, note }]
   */
  @column({
    prepare: (v: unknown[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare educationRecords: Record<string, unknown>[]

  /**
   * Khóa tập huấn / đào tạo / bồi dưỡng chuyên môn khác.
   * JSON: [{ id, name, organizer, location, startYear, endYear, certificate, note }]
   */
  @column({
    prepare: (v: unknown[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare trainingCourses: Record<string, unknown>[]

  @column()
  declare mainResearchArea: string | null

  /** FK fields — lĩnh vực nghiên cứu (danh mục). */
  @column()
  declare researchFieldId: number | null

  /** Chuyên ngành đào tạo (nguồn: nv_chuyennganh). */
  @column()
  declare specialization: string | null

  /** FK specializations — chuyên ngành (danh mục). */
  @column()
  declare specializationId: number | null

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

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare departmentUnit: BelongsTo<typeof Department>

  @belongsTo(() => Field, { foreignKey: 'researchFieldId' })
  declare researchField: BelongsTo<typeof Field>

  @belongsTo(() => Specialization, { foreignKey: 'specializationId' })
  declare specializationRef: BelongsTo<typeof Specialization>

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
