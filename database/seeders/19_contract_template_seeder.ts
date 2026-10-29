import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'
import RolePermission from '#models/role_permission'
import PermissionService from '#services/permission_service'
import ContractTemplate from '#models/contract_template'
import { detectDocxPlaceholders } from '#utils/docx_placeholder_helper'
import {
  buildPublicContractTemplateUrl,
  resolveContractTemplateDir,
} from '#utils/contract_template_storage'
import { QUYET_DINH_MERGE_TRONG } from '#constants/quyet_dinh_template_variables'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * US-05-01 — quyền mẫu BM.06 + seed mẫu mặc định từ resources/bm06.
 * Chạy: node ace db:seed --files=database/seeders/19_contract_template_seeder.ts
 */
const PERMS = [
  'contract_template.view',
  'contract_template.create',
  'contract_template.update',
  'contract_template.delete',
  'project.contract_manage',
]

const ROLE_CODES = ['ADMIN', 'SUPER_ADMIN', 'QUANLY_KH_CNTT_HTQT', 'RESEARCH_OFFICE']

export default class extends BaseSeeder {
  async run() {
    await PermissionService.syncMissingStandardPermissions()

    const permByCode = new Map<string, Permission>()
    for (const code of PERMS) {
      const p = await Permission.query().where('code', code).first()
      if (p) permByCode.set(code, p)
    }

    for (const roleCode of ROLE_CODES) {
      const role = await Role.query().where('code', roleCode).first()
      if (!role) continue
      for (const code of PERMS) {
        const perm = permByCode.get(code)
        if (!perm) continue
        const exists = await RolePermission.query()
          .where('role_id', role.id)
          .where('permission_id', perm.id)
          .first()
        if (!exists) {
          await RolePermission.create({ roleId: role.id, permissionId: perm.id })
        }
      }
    }

    await this.seedFile({
      code: 'BM06_DEFAULT',
      name: 'Mẫu hợp đồng BM.06 (chuẩn)',
      description: 'Mẫu DOCX có biến {{...}} — seed từ BM06_Mau_hop_dong_co_bien.docx',
      templateType: 'HOP_DONG',
      formCode: 'BM06',
      fileName: 'BM06_Mau_hop_dong_co_bien.docx',
      source: app.makePath('resources/bm06/BM06_Mau_hop_dong_co_bien.docx'),
    })

    await this.seedFile({
      code: 'TB_TUYEN_CHON_UED',
      name: 'Thông báo tuyển chọn đề tài (UED)',
      description: 'Mẫu thông báo tuyển chọn tổ chức, cá nhân chủ trì đề tài — Trường ĐHSP Đà Nẵng.',
      templateType: 'THONG_BAO',
      formCode: 'TB',
      fileName: 'Template_Thong_bao_tuyen_chon_de_tai_UED.docx',
      source: app.makePath('resources/thong-bao/Template_Thong_bao_tuyen_chon_de_tai_UED.docx'),
    })

    await this.seedFile({
      code: 'QD_THANH_LAP_HD_TM',
      name: 'Quyết định thành lập Hội đồng thẩm định thuyết minh',
      description:
        'Mẫu DOCX quyết định thành lập HĐ thẩm định thuyết minh — biến {{...}} theo phụ lục phiên họp.',
      templateType: 'QUYET_DINH',
      formCode: 'QD',
      fileName: 'Quyet_dinh_thanh_lap_Hoi_dong_TEMPLATE.docx',
      source: app.makePath('resources/quyet-dinh/Quyet_dinh_thanh_lap_Hoi_dong_TEMPLATE.docx'),
    })
  }

  private async seedFile(input: {
    code: string
    name: string
    description: string
    templateType: 'HOP_DONG' | 'THANH_LY' | 'THONG_BAO' | 'QUYET_DINH'
    formCode: string
    fileName: string
    source: string
  }) {
    const existing = await ContractTemplate.query().where('code', input.code).first()
    if (existing) return

    try {
      await fs.access(input.source)
    } catch {
      console.warn(`[19_contract_template] Bỏ qua ${input.code} — chưa có file ${input.source}`)
      return
    }

    const dir = await resolveContractTemplateDir()
    const stored = `${Date.now()}-${randomUUID()}.docx`
    const dest = path.join(dir, stored)
    await fs.copyFile(input.source, dest)
    const stat = await fs.stat(dest)
    let detected: string[] = []
    try {
      detected = await detectDocxPlaceholders(dest)
    } catch (e) {
      console.warn('[19_contract_template] Không quét được biến:', (e as Error).message)
    }

    await ContractTemplate.create({
      code: input.code,
      name: input.name,
      description: input.description,
      templateType: input.templateType,
      formCode: input.formCode,
      fileName: input.fileName,
      storedFileName: stored,
      fileUrl: buildPublicContractTemplateUrl(stored),
      fileSize: stat.size,
      detectedVariables: detected,
      mergeConfig:
        input.templateType === 'QUYET_DINH'
          ? ({
              ky_hieu: '',
              noi_nhan: '',
              tham_quyen_ky: '',
              ...QUYET_DINH_MERGE_TRONG,
            } as any)
          : undefined,
      isDefault: true,
      status: 'ACTIVE',
      version: 1,
      uploadedBy: null,
    })
  }
}
