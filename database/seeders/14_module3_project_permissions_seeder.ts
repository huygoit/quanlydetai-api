import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'
import PermissionService from '#services/permission_service'

/**
 * US Module 3 — đồng bộ quyền project/cfp/selection vào catalog
 * và gán gợi ý cho một số role chuẩn (Admin vẫn chỉnh lại trên IAM).
 *
 * Chạy: node ace db:seed --files=database/seeders/14_module3_project_permissions_seeder.ts
 */
const ROLE_PROJECT_MAP: Record<string, string[]> = {
  BASIC: ['project.view', 'project.create', 'project.update', 'project.submit', 'cfp.view'],
  RESEARCH_OFFICE: [
    'project.view',
    'project.review',
    'project.selection_manage',
    'project.adjustment_extend',
    'cfp.view',
    'cfp.create',
    'cfp.update',
    'cfp.submit',
    'cfp.extend',
    'cfp.close',
  ],
  QUANLY_KH_CNTT_HTQT: [
    'project.view',
    'project.review',
    'project.selection_manage',
    'project.adjustment_extend',
    'cfp.view',
    'cfp.create',
    'cfp.update',
    'cfp.submit',
    'cfp.extend',
    'cfp.close',
  ],
  DEPARTMENT_HEAD: [
    'project.view',
    'project.assign_reviewer',
    'project.approve',
    'project.selection_approve',
    'cfp.view',
    'cfp.approve',
  ],
  DEPARTMENT_STAFF: ['project.view', 'cfp.view', 'cfp.publish'],
}

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()

    const permByCode = new Map<string, Permission>()
    const allCodes = [...new Set(Object.values(ROLE_PROJECT_MAP).flat())]
    for (const code of allCodes) {
      const row = await Permission.query().where('code', code).first()
      if (row) permByCode.set(code, row)
    }

    for (const [roleCode, codes] of Object.entries(ROLE_PROJECT_MAP)) {
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
