import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import UserRoleAssignment from '#models/user_role_assignment'
import Role from '#models/role'

/**
 * Reset mật khẩu tất cả user về "123456789", trừ SUPER_ADMIN.
 */
export default class ResetPasswords extends BaseCommand {
  static commandName = 'reset:passwords'
  static description = 'Reset mật khẩu tất cả user về 123456789 (trừ super admin)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const newPassword = '123456789'

    // Lấy danh sách userId có role SUPER_ADMIN
    const superAdminRole = await Role.query().where('code', 'SUPER_ADMIN').first()
    let superAdminUserIds: number[] = []

    if (superAdminRole) {
      const assignments = await UserRoleAssignment.query()
        .where('role_id', superAdminRole.id)
        .where('is_active', true)
        .select('user_id')
      superAdminUserIds = [...new Set(assignments.map((a) => a.userId))]
    }

    // Lấy tất cả user trừ super admin
    const query = User.query()
    if (superAdminUserIds.length > 0) {
      query.whereNotIn('id', superAdminUserIds)
    }

    const users = await query.select('id', 'email', 'full_name')

    this.logger.info(`Bỏ qua ${superAdminUserIds.length} super admin(s)`)
    this.logger.info(`Sẽ reset mật khẩu ${users.length} user(s) về "${newPassword}"`)

    let count = 0
    for (const user of users) {
      user.password = newPassword
      await user.save()
      count++
      this.logger.info(`  ✓ ${user.email}`)
    }

    this.logger.success(`Đã reset mật khẩu ${count} user(s).`)
  }
}