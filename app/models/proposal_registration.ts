import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ProjectProposal from '#models/project_proposal'
import CallForProposal from '#models/call_for_proposal'
import ProposalRegistrationMember from '#models/proposal_registration_member'

/** Nháp, chờ đơn vị, chờ phòng, được chấp thuận, hoặc bị từ chối */
export type ProposalRegistrationStatus =
  | 'DRAFT'
  | 'CHO_DON_VI'
  | 'CHO_PKH'
  | 'DKDT_DUOC_CHAP_THUAN'
  | 'DKDT_TU_CHOI'

export default class ProposalRegistration extends BaseModel {
  static table = 'proposal_registrations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare projectProposalId: number

  @column()
  declare callForProposalId: number

  @column()
  declare ownerId: number

  @column()
  declare ownerName: string

  @column()
  declare ownerEmail: string | null

  @column()
  declare ownerUnit: string

  @column()
  declare proposedBudget: number

  @column()
  declare durationMonths: number

  @column()
  declare attachmentUrl: string | null

  @column()
  declare note: string | null

  /** Ghi chú khi đơn vị xác nhận, hoặc lý do trả lại */
  @column()
  declare unitComment: string | null

  /** Lý do phòng từ chối đơn này */
  @column()
  declare pkhReason: string | null

  @column()
  declare status: ProposalRegistrationStatus

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectProposal, { foreignKey: 'projectProposalId' })
  declare projectProposal: BelongsTo<typeof ProjectProposal>

  @belongsTo(() => CallForProposal, { foreignKey: 'callForProposalId' })
  declare callForProposal: BelongsTo<typeof CallForProposal>

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @hasMany(() => ProposalRegistrationMember, { foreignKey: 'proposalRegistrationId' })
  declare members: HasMany<typeof ProposalRegistrationMember>

  /** Mã hồ sơ: DK-{năm}-{số thứ tự 3 chữ số} */
  static async generateCode(year: number): Promise<string> {
    const last = await ProposalRegistration.query()
      .where('code', 'like', `DK-${year}-%`)
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = lastSeq + 1
    }
    return `DK-${year}-${String(seq).padStart(3, '0')}`
  }
}
