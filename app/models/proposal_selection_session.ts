import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import CallForProposal from '#models/call_for_proposal'
import ProposalSelectionSessionItem from '#models/proposal_selection_session_item'
import ProposalSelectionSessionMember from '#models/proposal_selection_session_member'

/**
 * Trạng thái phiên xét chọn:
 * CREATED → OPEN → MINUTES_SAVED → PENDING_BGH → LOCKED | RETURNED
 */
export type SelectionSessionStatus =
  | 'CREATED'
  | 'OPEN'
  | 'MINUTES_SAVED'
  | 'PENDING_BGH'
  | 'LOCKED'
  | 'RETURNED'

export default class ProposalSelectionSession extends BaseModel {
  static table = 'proposal_selection_sessions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare callForProposalId: number

  @column()
  declare title: string | null

  @column.dateTime()
  declare meetingAt: DateTime

  @column()
  declare location: string

  @column()
  declare createdBy: number

  @column()
  declare forceConfirmed: boolean

  @column()
  declare status: SelectionSessionStatus | string

  @column({
    prepare: (v: unknown) => JSON.stringify(v ?? []),
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
  declare councilMembers: Array<{ name: string; role?: string }>

  @column()
  declare minutesHtml: string | null

  @column()
  declare minutesFileUrl: string | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column()
  declare submittedBy: number | null

  @column.dateTime()
  declare bghReviewedAt: DateTime | null

  @column()
  declare bghReviewedBy: number | null

  @column()
  declare bghComment: string | null

  @column.dateTime()
  declare lockedAt: DateTime | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => CallForProposal, { foreignKey: 'callForProposalId' })
  declare callForProposal: BelongsTo<typeof CallForProposal>

  @hasMany(() => ProposalSelectionSessionItem, { foreignKey: 'sessionId' })
  declare items: HasMany<typeof ProposalSelectionSessionItem>

  @hasMany(() => ProposalSelectionSessionMember, { foreignKey: 'sessionId' })
  declare members: HasMany<typeof ProposalSelectionSessionMember>
}
