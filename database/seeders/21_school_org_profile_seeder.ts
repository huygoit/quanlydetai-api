import { BaseSeeder } from '@adonisjs/lucid/seeders'
import PermissionService from '#services/permission_service'
import { SCHOOL_ORG_PROFILE_KEY } from '#services/school_org_profile_service'
import SystemConfig from '#models/system_config'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'

/**
 * Seed profile trường (Bên A) + quyền org_profile.
 * Chạy: node ace db:seed --files=database/seeders/21_school_org_profile_seeder.ts
 */
const PROFILE = {
  logoUrl: null as string | null,
  schoolName: 'Trường Đại học Sư phạm — Đại học Đà Nẵng',
  universitySystem: 'Đại học Đà Nẵng',
  daiDienBenA: 'PGS.TS. Nguyễn Văn A',
  chucVuBenA: 'Hiệu trưởng',
  diaChiBenA: '459 Tôn Đức Thắng, quận Liên Chiểu, thành phố Đà Nẵng',
  dienThoaiBenA: '0236.3841.323',
  emailBenA: 'ued@ued.udn.vn',
  taiKhoanBenA: '123456789',
  nganHangBenA: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV) — CN Đà Nẵng',
  maSoThueBenA: '0400xxxxx',
}

const ROLE_CODES = ['ADMIN', 'SUPER_ADMIN', 'QUANLY_KH_CNTT_HTQT', 'RESEARCH_OFFICE']

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()

    for (const code of ['org_profile.view', 'org_profile.update']) {
      const perm = await Permission.query().where('code', code).first()
      if (!perm) continue
      for (const roleCode of ROLE_CODES) {
        const role = await Role.query().where('code', roleCode).first()
        if (!role) continue
        const exists = await RolePermission.query()
          .where('role_id', role.id)
          .where('permission_id', perm.id)
          .first()
        if (!exists) {
          await RolePermission.create({ roleId: role.id, permissionId: perm.id })
        }
      }
    }

    const payload = JSON.stringify(PROFILE)
    const row = await SystemConfig.findBy('key', SCHOOL_ORG_PROFILE_KEY)
    if (!row) {
      await SystemConfig.create({
        key: SCHOOL_ORG_PROFILE_KEY,
        value: payload,
        description: 'Profile trường / Bên A (logo, tên, đại diện, MST…) cho BM.06 & branding',
      })
    } else {
      row.value = payload
      row.description =
        row.description ||
        'Profile trường / Bên A (logo, tên, đại diện, MST…) cho BM.06 & branding'
      await row.save()
    }
  }
}
