import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany } from '@adonisjs/lucid/types/relations'
import Permission from '#models/permission'
import UserRoleAssignment from '#models/user_role_assignment'

export type RoleStatus = 'ACTIVE' | 'INACTIVE'

/**
 * Role cho RBAC.
 */
export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare status: RoleStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotTimestamps: false,
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => UserRoleAssignment)
  declare userRoleAssignments: HasMany<typeof UserRoleAssignment>
}
