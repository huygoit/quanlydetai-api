import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectProposal from '#models/project_proposal'
import ProposalRegistration from '#models/proposal_registration'
import User from '#models/user'
import ProjectOutline from '#models/project_outline'

/** Nhiệm vụ đã phân công cho một chủ nhiệm sau khi phòng chấp thuận đơn đăng ký */
export default class OfficialAssignment extends BaseModel {
  static table = 'official_assignments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare danhMucId: number

  @column()
  declare dangKyId: number

  @column()
  declare ideaId: number | null

  @column()
  declare principalUserId: number

  @column()
  declare principalName: string

  @column()
  declare status: 'DUOC_GIAO'

  @column()
  declare outlineId: number | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectProposal, { foreignKey: 'danhMucId' })
  declare danhMuc: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => ProposalRegistration, { foreignKey: 'dangKyId' })
  declare dangKy: BelongsTo<typeof ProposalRegistration>

  @belongsTo(() => User, { foreignKey: 'principalUserId' })
  declare principal: BelongsTo<typeof User>

  @belongsTo(() => ProjectOutline, { foreignKey: 'outlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>

  static async generateCode(year: number): Promise<string> {
    const last = await OfficialAssignment.query()
      .where('code', 'like', `NV-${year}-%`)
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      seq = parseInt(parts[2] || '0', 10) + 1
    }
    return `NV-${year}-${String(seq).padStart(3, '0')}`
  }
}
