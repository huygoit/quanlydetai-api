import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProposalRegistration from '#models/proposal_registration'
import ScientificProfile from '#models/scientific_profile'
import Student from '#models/student'
import Department from '#models/department'
import type { AffiliationType, AuthorGender } from '#models/publication_author'
import type { ProposalMemberRole } from '#constants/proposal_member_role'

/** Thành viên của một hồ sơ đăng ký thực hiện */
export default class ProposalRegistrationMember extends BaseModel {
  static table = 'proposal_registration_members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare proposalRegistrationId: number

  @column()
  declare profileId: number | null

  @column()
  declare studentId: number | null

  @column()
  declare departmentId: number | null

  @column()
  declare gender: AuthorGender | null

  @column()
  declare fullName: string

  @column()
  declare memberOrder: number

  @column()
  declare role: ProposalMemberRole

  @column()
  declare affiliationType: AffiliationType

  @column()
  declare isMultiAffiliationOutsideUdn: boolean

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (Array.isArray(v)) return v
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
      return []
    },
  })
  declare affiliationUnits: string[]

  @column()
  declare contributionPercent: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProposalRegistration, { foreignKey: 'proposalRegistrationId' })
  declare registration: BelongsTo<typeof ProposalRegistration>

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>

  @belongsTo(() => Student, { foreignKey: 'studentId' })
  declare student: BelongsTo<typeof Student>

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare department: BelongsTo<typeof Department>
}
