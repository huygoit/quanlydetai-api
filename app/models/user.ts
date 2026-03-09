import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import UserRoleAssignment from '#models/user_role_assignment'
import Department from '#models/department'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { UserRole } from '#types/user'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  /** Role trong hệ thống: NCV, CNDT, TRUONG_DON_VI, PHONG_KH, HOI_DONG, LANH_DAO, ADMIN */
  @column()
  declare role: UserRole

  /** Nhãn hiển thị role (VD: "Nhà khoa học", "Phòng Khoa học") */
  @column()
  declare roleLabel: string | null

  @column()
  declare avatarUrl: string | null

  @column()
  declare phone: string | null

  /** Đơn vị công tác (legacy - text) */
  @column()
  declare unit: string | null

  /** FK tới departments - đơn vị mới */
  @column()
  declare departmentId: number | null

  /** Ghi chú */
  @column()
  declare note: string | null

  /** Lần đăng nhập cuối */
  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Department)
  declare department: BelongsTo<typeof Department>

  @hasMany(() => UserRoleAssignment)
  declare roleAssignments: HasMany<typeof UserRoleAssignment>

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
