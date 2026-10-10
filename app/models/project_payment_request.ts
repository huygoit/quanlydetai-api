import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'
import type { YcktStatus } from '#constants/module56'
import type { StoredFile } from '#models/project_progress_report'

export default class ProjectPaymentRequest extends BaseModel {
  static table = 'project_payment_requests'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare kind: 'TAM_UNG' | 'THANH_TOAN'

  @column()
  declare lineCode: string

  @column()
  declare amount: number

  @column()
  declare detail: string | null

  @column()
  declare bankAccount: string | null

  @column()
  declare bankName: string | null

  @column(jsonAttr<StoredFile[]>([]))
  declare attachments: StoredFile[]

  @column()
  declare status: YcktStatus

  @column()
  declare overBudget: boolean

  @column()
  declare returnReason: string | null

  @column()
  declare voucherNo: string | null

  @column.date()
  declare voucherDate: DateTime | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
