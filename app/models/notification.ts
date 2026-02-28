import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { NotificationType } from '#types/notification'
import User from '#models/user'

/**
 * Thông báo gửi đến user (field `read` khớp với frontend, không dùng is_read).
 */
export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare type: NotificationType

  @column()
  declare title: string

  @column()
  declare message: string

  @column()
  declare link: string | null

  /** Đã đọc hay chưa - tên field `read` theo đặc tả frontend */
  @column({ columnName: 'read' })
  declare read: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}
