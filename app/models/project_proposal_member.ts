import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import Student from '#models/student'
import Department from '#models/department'
import type { AffiliationType, AuthorGender } from '#models/publication_author'
import type { ProposalMemberRole } from '#constants/proposal_member_role'

/**
 * Thành viên đề xuất đề tài (bảng project_proposal_members).
 * Vai trò: PRINCIPAL | SECRETARY | MEMBER (không dùng is_top_author bài báo).
 */
export default class ProjectProposalMember extends BaseModel {
  static table = 'project_proposal_members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectProposalId: number

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

  /** Chủ nhiệm / Thư ký / Thành viên */
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

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare projectProposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => ScientificProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof ScientificProfile>

  @belongsTo(() => Student, { foreignKey: 'studentId' })
  declare student: BelongsTo<typeof Student>

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare department: BelongsTo<typeof Department>
}
