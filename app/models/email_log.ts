import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Log gửi email (STUB khi chưa SMTP | SENT | FAILED). */
export default class EmailLog extends BaseModel {
  static table = 'email_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare toEmail: string

  @column()
  declare subject: string

  @column()
  declare body: string

  @column()
  declare relatedType: string | null

  @column()
  declare relatedId: number | null

  /** STUB | PENDING | SENT | FAILED */
  @column()
  declare status: string

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
