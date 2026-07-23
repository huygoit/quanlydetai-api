import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import CallForProposal from '#models/call_for_proposal'

export type CfpAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'SUBMIT'
  | 'APPROVE'
  | 'RETURN'
  | 'PUBLISH'
  | 'EXTEND'
  | 'CLOSE'
  | 'REMIND_HC'

export default class CallForProposalAudit extends BaseModel {
  static table = 'call_for_proposal_audits'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare callForProposalId: number

  @column()
  declare actorUserId: number

  @column()
  declare action: CfpAuditAction

  @column()
  declare note: string | null

  @column({
    prepare: (v: Record<string, unknown> | null) => (v == null ? null : JSON.stringify(v)),
    consume: (v: string | unknown) => {
      if (v == null) return null
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return null
        }
      }
      return typeof v === 'object' ? (v as Record<string, unknown>) : null
    },
  })
  declare diffJson: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => CallForProposal, { foreignKey: 'callForProposalId' })
  declare callForProposal: BelongsTo<typeof CallForProposal>

  @belongsTo(() => User, { foreignKey: 'actorUserId' })
  declare actor: BelongsTo<typeof User>
}
