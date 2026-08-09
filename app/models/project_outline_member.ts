import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import ScientificProfile from '#models/scientific_profile'
import Student from '#models/student'
import type { ProposalMemberRole } from '#constants/proposal_member_role'

export default class ProjectOutlineMember extends BaseModel {
  static table = 'project_outline_members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare profileId: number | null

  @column()
  declare studentId: number | null

  @column()
  declare departmentId: number | null

  @column()
  declare fullName: string

  @column()
  declare memberOrder: number

  @column()
  declare role: ProposalMemberRole

  @column()
  declare affiliationType: string | null

  @column()
  declare gender: string | null

  @column()
  declare isMultiAffiliationOutsideUdn: boolean

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (Array.isArray(v)) return v
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p : []
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

  @column()
  declare participationHours: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare projectOutline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>

  @belongsTo(() => Student, { foreignKey: 'studentId' })
  declare student: BelongsTo<typeof Student>
}
