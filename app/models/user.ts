import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
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

  /** Đơn vị công tác */
  @column()
  declare unit: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
