import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import UserRoleAssignment from '#models/user_role_assignment'
import Role from '#models/role'
import BasicRoleService from '#services/basic_role_service'

/**
 * Gán role BASIC (hệ thống) cho toàn bộ user hiện tại, trừ super admin.
 */
export default class AssignBasicRole extends BaseCommand {
  static commandName = 'assign:basic-role'
  static description = 'Gán role BASIC cho toàn bộ user (trừ super admin)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
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
    this.logger.info(`Sẽ gán role BASIC cho ${users.length} user(s)`)

    const basicRole = await BasicRoleService.getOrCreateBasicRole()
    let assigned = 0
    let skipped = 0

    for (const user of users) {
      const hadRole = await UserRoleAssignment.query()
        .where('user_id', user.id)
        .where('role_id', basicRole.id)
        .first()

      await BasicRoleService.assignBasicRoleToUser(user.id)

      if (hadRole) {
        skipped++
      } else {
        assigned++
        this.logger.info(`  ✓ ${user.email}`)
      }
    }

    this.logger.success(`Đã gán role BASIC: ${assigned} user(s) mới, ${skipped} user(s) đã có sẵn.`)
  }
}