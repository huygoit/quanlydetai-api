import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'
import PermissionService from '#services/permission_service'

/**
 * US Module 4 — quyền thuyết minh / phản biện kín / bảo vệ.
 * Gán gợi ý role chuẩn; Admin vẫn chỉnh trên IAM.
 *
 * Chạy: node ace db:seed --files=database/seeders/17_module4_outline_permissions_seeder.ts
 */
const ROLE_MODULE4_MAP: Record<string, string[]> = {
  /** GV / NCV — soạn TM + chấm khi được phân công PB */
  BASIC: [
    'project.outline_manage',
    'project.blind_review_score',
    'project.view',
    'project.create',
    'project.update',
    'project.submit',
  ],
  /** PKH */
  RESEARCH_OFFICE: [
    'project.outline_manage',
    'project.blind_review_assign',
    'project.blind_review_score',
    'project.defense_manage',
    'project.outline_revision_extend',
    'project.review',
    'project.selection_manage',
    'project.view',
  ],
  QUANLY_KH_CNTT_HTQT: [
    'project.outline_manage',
    'project.blind_review_assign',
    'project.blind_review_score',
    'project.defense_manage',
    'project.outline_revision_extend',
    'project.review',
    'project.selection_manage',
    'project.view',
  ],
  /** BGH / trưởng đơn vị — xem tiến độ (không bắt buộc quản lý bảo vệ) */
  DEPARTMENT_HEAD: ['project.view', 'project.blind_review_score'],
}

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()

    const permByCode = new Map<string, Permission>()
    const allCodes = [...new Set(Object.values(ROLE_MODULE4_MAP).flat())]
    for (const code of allCodes) {
      const row = await Permission.query().where('code', code).first()
      if (row) permByCode.set(code, row)
    }

    for (const [roleCode, codes] of Object.entries(ROLE_MODULE4_MAP)) {
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
