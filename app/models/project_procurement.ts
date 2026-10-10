import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'
import type { MsStatus } from '#constants/module56'
import type { StoredFile } from '#models/project_progress_report'

export type ProcurementItem = {
  name: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  spec: string
}

export default class ProjectProcurement extends BaseModel {
  static table = 'project_procurements'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare kind: 'VAT_TU' | 'DUNG_CU' | 'THIET_BI' | 'THUE_NGOAI'

  @column()
  declare lineCode: string

  @column()
  declare purpose: string | null

  @column.date()
  declare neededBy: DateTime | null

  @column(jsonAttr<ProcurementItem[]>([]))
  declare items: ProcurementItem[]

  @column(jsonAttr<StoredFile[]>([]))
  declare attachments: StoredFile[]

  @column()
  declare totalAmount: number

  @column()
  declare status: MsStatus

  @column()
  declare overBudget: boolean

  @column()
  declare overBudgetNote: string | null

  @column()
  declare csvcMethod: 'MUA_TRUC_TIEP' | 'DAU_THAU' | null

  @column.dateTime()
  declare suppliedAt: DateTime | null

  @column.dateTime()
  declare receivedAt: DateTime | null

  @column()
  declare voucherNo: string | null

  @column.date()
  declare voucherDate: DateTime | null

  @column()
  declare returnReason: string | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
