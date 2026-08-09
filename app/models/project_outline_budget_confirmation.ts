import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import User from '#models/user'

export type BudgetConfirmationStatus =
  | 'DRAFT'
  | 'SENT_TO_TC'
  | 'RETURNED_BY_TC'
  | 'CONFIRMED'
  | 'LD_APPROVED'
  | 'LD_REJECTED'
  | 'LD_RETURNED'

export type LdBudgetDecision = 'APPROVE' | 'REJECT' | 'RETURN'

export default class ProjectOutlineBudgetConfirmation extends BaseModel {
  static table = 'project_outline_budget_confirmations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare status: BudgetConfirmationStatus

  @column()
  declare requestedBudgetSnapshot: number

  @column()
  declare pkhProposedBudget: number | null

  @column()
  declare pkhNote: string | null

  @column()
  declare pkhProposedBy: number | null

  @column.dateTime()
  declare pkhProposedAt: DateTime | null

  @column()
  declare tcConfirmedBudget: number | null

  @column()
  declare tcNote: string | null

  @column()
  declare tcAdjusted: boolean

  @column()
  declare tcBy: number | null

  @column.dateTime()
  declare tcAt: DateTime | null

  @column()
  declare tcReturnReason: string | null

  @column()
  declare requiresLargeBudgetCouncil: boolean

  @column()
  declare largeBudgetCouncilDone: boolean

  @column()
  declare largeBudgetCouncilNote: string | null

  @column()
  declare largeBudgetMinutesUrl: string | null

  @column()
  declare ldDecision: LdBudgetDecision | null

  @column()
  declare ldNote: string | null

  @column()
  declare ldRejectReason: string | null

  @column()
  declare ldBy: number | null

  @column.dateTime()
  declare ldAt: DateTime | null

  @column()
  declare approvedBudget: number | null

  @column.dateTime()
  declare module5OpenedAt: DateTime | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => User, { foreignKey: 'pkhProposedBy' })
  declare pkhUser: BelongsTo<typeof User>
}
