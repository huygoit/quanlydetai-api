import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'

/**
 * Seed permission cfp.* và gán sẵn cho một số role chuẩn.
 * Chạy: node ace db:seed --files=database/seeders/13_cfp_permissions_seeder.ts
 */
const CFP_PERMS: Array<{ code: string; name: string; action: string }> = [
  { code: 'cfp.view', name: 'Xem thông báo tuyển chọn', action: 'view' },
  { code: 'cfp.create', name: 'Tạo thông báo tuyển chọn', action: 'create' },
  { code: 'cfp.update', name: 'Sửa thông báo tuyển chọn', action: 'update' },
  { code: 'cfp.submit', name: 'Trình duyệt thông báo tuyển chọn', action: 'submit' },
  { code: 'cfp.approve', name: 'Duyệt / trả về thông báo tuyển chọn', action: 'approve' },
  { code: 'cfp.publish', name: 'Phát hành thông báo tuyển chọn', action: 'publish' },
  { code: 'cfp.extend', name: 'Gia hạn kỳ nộp hồ sơ', action: 'extend' },
  { code: 'cfp.close', name: 'Đóng sớm kỳ nộp hồ sơ', action: 'close' },
]

/** Role → danh sách code quyền CFP gán sẵn */
const ROLE_CFP_MAP: Record<string, string[]> = {
  BASIC: ['cfp.view'],
  RESEARCH_OFFICE: [
    'cfp.view',
    'cfp.create',
    'cfp.update',
    'cfp.submit',
    'cfp.extend',
    'cfp.close',
  ],
  QUANLY_KH_CNTT_HTQT: [
    'cfp.view',
    'cfp.create',
    'cfp.update',
    'cfp.submit',
    'cfp.extend',
    'cfp.close',
  ],
  // Lãnh đạo / BGH: duyệt
  DEPARTMENT_HEAD: ['cfp.view', 'cfp.approve'],
  // HC: phát hành (nếu chưa có role HC riêng, gán tạm DEPARTMENT_STAFF)
  DEPARTMENT_STAFF: ['cfp.view', 'cfp.publish'],
}

export default class extends BaseSeeder {
  async run() {
    const permByCode = new Map<string, Permission>()

    for (const p of CFP_PERMS) {
      let row = await Permission.query().where('code', p.code).first()
      if (!row) {
        row = await Permission.create({
          code: p.code,
          name: p.name,
          module: 'cfp',
          action: p.action,
          status: 'ACTIVE',
        })
      } else if (row.name !== p.name) {
        row.name = p.name
        await row.save()
      }
      permByCode.set(p.code, row)
    }

    for (const [roleCode, codes] of Object.entries(ROLE_CFP_MAP)) {
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
