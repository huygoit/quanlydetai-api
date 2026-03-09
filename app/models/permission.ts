import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'

export type PermissionStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Permission cho RBAC. Code format: module.action
 */
export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare module: string

  @column()
  declare action: string

  @column()
  declare description: string | null

  @column()
  declare status: PermissionStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
    pivotTimestamps: false,
  })
  declare roles: ManyToMany<typeof Role>
}
