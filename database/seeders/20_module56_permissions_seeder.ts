import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'
import PermissionService from '#services/permission_service'

/**
 * Module 5–6 — quyền ký phát hành, xác nhận gia hạn, CSVC.
 * Chạy: node ace db:seed --files=database/seeders/20_module56_permissions_seeder.ts
 */
const ROLE_MAP: Record<string, string[]> = {
  ADMIN: [
    'project.contract_manage',
    'project.contract_publish',
    'project.contract_lead_confirm',
    'project.procurement_handle',
    'project.budget_confirm',
    'project.outline_approve',
  ],
  SUPER_ADMIN: [
    'project.contract_manage',
    'project.contract_publish',
    'project.contract_lead_confirm',
    'project.procurement_handle',
  ],
  RESEARCH_OFFICE: ['project.contract_manage', 'project.contract_lead_confirm'],
  QUANLY_KH_CNTT_HTQT: ['project.contract_manage', 'project.contract_lead_confirm'],
  DEPARTMENT_STAFF: ['project.contract_publish', 'project.procurement_handle', 'project.budget_confirm'],
  DEPARTMENT_HEAD: ['project.outline_approve'],
  KH_TC: ['project.budget_confirm', 'project.view'],
  TC_HC: ['project.contract_publish', 'project.view'],
  CSVC: ['project.procurement_handle', 'project.view'],
}

const ROLE_MOI: Record<string, { name: string; description: string }> = {
  KH_TC: {
    name: 'Phòng Kế hoạch - Tài chính',
    description: 'Xác nhận chứng từ và quyết toán khi triển khai',
  },
  TC_HC: {
    name: 'Phòng Tổ chức - Hành chính',
    description: 'Phát hành hợp đồng và biên bản thanh lý',
  },
  CSVC: {
    name: 'Phòng Cơ sở vật chất',
    description: 'Tiếp nhận và xử lý phiếu mua sắm',
  },
}

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()
    const codes = [...new Set(Object.values(ROLE_MAP).flat())]
    const permByCode = new Map<string, Permission>()
    for (const code of codes) {
      const row = await Permission.query().where('code', code).first()
      if (row) permByCode.set(code, row)
    }
    for (const [roleCode, list] of Object.entries(ROLE_MAP)) {
      let role = await Role.query().where('code', roleCode).first()
      const moTa = ROLE_MOI[roleCode]
      if (!role && moTa) {
        role = await Role.create({
          code: roleCode,
          name: moTa.name,
          description: moTa.description,
          status: 'ACTIVE',
        })
      }
      if (!role) continue
      for (const code of list) {
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
