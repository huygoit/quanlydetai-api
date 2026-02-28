import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Nhật ký audit: ghi lại hành động (CREATE, UPDATE, DELETE, ...) trên các entity.
 */
export default class AuditLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare userName: string

  @column()
  declare action: string

  @column()
  declare entityType: string

  @column()
  declare entityId: string | null

  @column({
    prepare: (value: object | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: string | Record<string, unknown> | null) =>
      value === null ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare oldData: Record<string, unknown> | null

  @column({
    prepare: (value: object | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: string | Record<string, unknown> | null) =>
      value === null ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare newData: Record<string, unknown> | null

  @column()
  declare ipAddress: string

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
