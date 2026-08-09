import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'
import PermissionService from '#services/permission_service'

/**
 * US-04-06 — quyền đề xuất KP / TC xác nhận / LĐ phê duyệt.
 * Chạy: node ace db:seed --files=database/seeders/18_module4_budget_permissions_seeder.ts
 */
const ROLE_MAP: Record<string, string[]> = {
  RESEARCH_OFFICE: [
    'project.budget_propose',
    'project.review',
    'project.view',
  ],
  QUANLY_KH_CNTT_HTQT: [
    'project.budget_propose',
    'project.review',
    'project.view',
  ],
  /** TC — gán tạm DEPARTMENT_STAFF + liquidation */
  DEPARTMENT_STAFF: [
    'project.budget_confirm',
    'project.liquidation',
    'project.view',
  ],
  /** LĐ / BGH */
  DEPARTMENT_HEAD: [
    'project.outline_approve',
    'project.approve',
    'project.selection_approve',
    'project.view',
  ],
}

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()
    const permByCode = new Map<string, Permission>()
    const allCodes = [...new Set(Object.values(ROLE_MAP).flat())]
    for (const code of allCodes) {
      const row = await Permission.query().where('code', code).first()
      if (row) permByCode.set(code, row)
    }
    for (const [roleCode, codes] of Object.entries(ROLE_MAP)) {
      const role = await Role.query().where('code', roleCode).first()
      if (!role) continue
      for (const code of codes) {
        const perm = permByCode.get(code)
        if (!perm) continue
        const existed = await RolePermission.query()
          .where('role_id', role.id)
          .where('permission_id', perm.id)
          .first()
        if (!existed) {
          await RolePermission.create({ roleId: role.id, permissionId: perm.id })
        }
      }
    }
  }
}
