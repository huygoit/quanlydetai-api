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

    const existing = await ContractTemplate.query().where('code', 'BM06_DEFAULT').first()
    if (existing) return

    const seedSrc = app.makePath('resources/bm06/BM06_Mau_hop_dong_co_bien.docx')
    try {
      await fs.access(seedSrc)
    } catch {
      console.warn('[19_contract_template] Bỏ qua seed file — chưa có resources/bm06/BM06_Mau_hop_dong_co_bien.docx')
      return
    }

    const dir = await resolveContractTemplateDir()
    const stored = `${Date.now()}-${randomUUID()}.docx`
    const dest = path.join(dir, stored)
    await fs.copyFile(seedSrc, dest)
    const stat = await fs.stat(dest)
    let detected: string[] = []
    try {
      detected = await detectDocxPlaceholders(dest)
    } catch (e) {
      console.warn('[19_contract_template] Không quét được biến:', (e as Error).message)
    }

    await ContractTemplate.create({
      code: 'BM06_DEFAULT',
      name: 'Mẫu hợp đồng BM.06 (chuẩn)',
      description: 'Mẫu DOCX có biến {{...}} — seed từ BM06_Mau_hop_dong_co_bien.docx',
      templateType: 'HOP_DONG',
      formCode: 'BM06',
      fileName: 'BM06_Mau_hop_dong_co_bien.docx',
      storedFileName: stored,
      fileUrl: buildPublicContractTemplateUrl(stored),
      fileSize: stat.size,
      detectedVariables: detected,
      isDefault: true,
      status: 'ACTIVE',
      version: 1,
      uploadedBy: null,
    })
  }
}
