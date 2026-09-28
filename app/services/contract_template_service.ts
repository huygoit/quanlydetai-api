import ContractTemplate from '#models/contract_template'
import type { ContractTemplateStatus, ContractTemplateType } from '#models/contract_template'
import { BM06_TEMPLATE_VARIABLES } from '#constants/bm06_template_variables'
import {
  DOC_TEMPLATE_TYPES,
  getDocTemplateType,
  isDocTemplateType,
} from '#constants/doc_template_types'
import { detectDocxPlaceholders } from '#utils/docx_placeholder_helper'
import {
  buildPublicContractTemplateUrl,
  findContractTemplateFilePath,
  resolveContractTemplateDir,
} from '#utils/contract_template_storage'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export interface ContractTemplateFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  templateType?: string
  formCode?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

interface MetaPayload {
  code: string
  name: string
  description?: string | null
  templateType: ContractTemplateType
  formCode?: string | null
  status?: ContractTemplateStatus
  isDefault?: boolean
}

function knownVariablesForType(templateType: string) {
  if (templateType === 'HOP_DONG') return BM06_TEMPLATE_VARIABLES
  return []
}

/**
 * Quản lý mẫu DOCX theo loại (hợp đồng, thanh lý, …).
 */
export default class ContractTemplateService {
  static listTypes() {
    return DOC_TEMPLATE_TYPES
  }

  static listVariableCatalog(templateType?: string) {
    const type = templateType && isDocTemplateType(templateType) ? templateType : 'HOP_DONG'
    return knownVariablesForType(type)
  }

  static serialize(row: ContractTemplate) {
    const detected = row.detectedVariables || []
    const known = knownVariablesForType(row.templateType)
    const knownSet = new Set(known.map((v) => v.key))
    const typeDef = getDocTemplateType(row.templateType)
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      template_type: row.templateType,
      template_type_label: typeDef?.label || row.templateType,
      form_code: row.formCode,
      file_name: row.fileName,
      stored_file_name: row.storedFileName,
      file_url: row.fileUrl,
      file_size: row.fileSize,
      detected_variables: detected,
      unknown_variables: known.length
        ? detected.filter((k) => !knownSet.has(k))
        : [],
      missing_known_variables: known.map((v) => v.key).filter((k) => !detected.includes(k)),
      is_default: !!row.isDefault,
      status: row.status,
      version: row.version,
      uploaded_by: row.uploadedBy,
      created_at: row.createdAt?.toISO() ?? null,
      updated_at: row.updatedAt?.toISO() ?? null,
    }
  }

  static async paginate(
    filters: ContractTemplateFilters = {}
  ): Promise<ModelPaginatorContract<ContractTemplate>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 100)
    const q = ContractTemplate.query()

    if (filters.status) q.where('status', filters.status)
    if (filters.templateType) q.where('template_type', filters.templateType)
    if (filters.formCode) q.where('form_code', filters.formCode)
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`)
          .orWhereILike('name', `%${filters.keyword}%`)
          .orWhereILike('description', `%${filters.keyword}%`)
      })
    }

    const sortBy = filters.sortBy || 'created_at'
    const order = filters.order === 'asc' ? 'asc' : 'desc'
    const valid = [
      'created_at',
      'code',
      'name',
      'status',
      'is_default',
      'updated_at',
      'template_type',
    ]
    q.orderBy(valid.includes(sortBy) ? sortBy : 'created_at', order)
    if (sortBy !== 'is_default') q.orderBy('is_default', 'desc')

    return q.paginate(page, perPage)
  }

  static async findById(id: number) {
    const row = await ContractTemplate.find(id)
    if (!row) throw new Error('CONTRACT_TEMPLATE_NOT_FOUND')
    return row
  }

  static async getDefaultActive(templateType: ContractTemplateType = 'HOP_DONG') {
    return ContractTemplate.query()
      .where('template_type', templateType)
      .where('status', 'ACTIVE')
      .where('is_default', true)
      .first()
  }

  private static normalizeTemplateType(raw?: string | null): ContractTemplateType {
    const v = (raw || 'HOP_DONG').trim().toUpperCase()
    if (!isDocTemplateType(v)) throw new Error('INVALID_TEMPLATE_TYPE')
    return v
  }

  private static async assertUniqueCode(code: string, excludeId?: number) {
    const q = ContractTemplate.query().where('code', code)
    if (excludeId) q.whereNot('id', excludeId)
    const exists = await q.first()
    if (exists) throw new Error('CODE_EXISTS')
  }

  private static async clearOtherDefaults(templateType: string, keepId?: number) {
    const q = ContractTemplate.query()
      .where('template_type', templateType)
      .where('is_default', true)
    if (keepId) q.whereNot('id', keepId)
    const rows = await q
    for (const r of rows) {
      r.isDefault = false
      await r.save()
    }
  }

  private static async saveUploadedDocx(file: MultipartFile) {
    const ext = path.extname(file.clientName || '').toLowerCase()
    if (ext !== '.docx') {
      throw new Error('INVALID_FILE_TYPE')
    }
    const dir = await resolveContractTemplateDir()
    const stored = `${Date.now()}-${randomUUID()}${ext}`
    await file.move(dir, { name: stored })
    if (file.hasErrors) {
      throw new Error('UPLOAD_FAILED')
    }
    const fullPath = path.join(dir, stored)
    const stat = await fs.stat(fullPath)
    let detected: string[] = []
    try {
      detected = await detectDocxPlaceholders(fullPath)
    } catch {
      detected = []
    }
    return {
      storedFileName: stored,
      fileName: file.clientName,
      fileUrl: buildPublicContractTemplateUrl(stored),
      fileSize: stat.size,
      detectedVariables: detected,
      fullPath,
    }
  }

  static async create(actorId: number, payload: MetaPayload, file: MultipartFile) {
    const code = payload.code.trim().toUpperCase()
    await this.assertUniqueCode(code)
    const saved = await this.saveUploadedDocx(file)
    const templateType = this.normalizeTemplateType(payload.templateType)
    const typeDef = getDocTemplateType(templateType)
    const formCode =
      (payload.formCode?.trim() || typeDef?.defaultFormCode || templateType).toUpperCase()
    const wantDefault = payload.isDefault !== false

    if (wantDefault) await this.clearOtherDefaults(templateType)

    const row = await ContractTemplate.create({
      code,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      templateType,
      formCode,
      fileName: saved.fileName,
      storedFileName: saved.storedFileName,
      fileUrl: saved.fileUrl,
      fileSize: saved.fileSize,
      detectedVariables: saved.detectedVariables,
      isDefault: wantDefault,
      status: payload.status || 'ACTIVE',
      version: 1,
      uploadedBy: actorId,
    })
    return row
  }

  static async update(
    id: number,
    actorId: number,
    payload: Partial<MetaPayload>,
    file?: MultipartFile | null
  ) {
    const row = await this.findById(id)
    if (payload.code != null) {
      const code = payload.code.trim().toUpperCase()
      await this.assertUniqueCode(code, id)
      row.code = code
    }
    if (payload.name != null) row.name = payload.name.trim()
    if (payload.description !== undefined) {
      row.description = payload.description?.trim() || null
    }
    if (payload.templateType != null) {
      row.templateType = this.normalizeTemplateType(payload.templateType)
    }
    if (payload.formCode !== undefined) {
      row.formCode = (payload.formCode?.trim() || '').toUpperCase() || row.formCode
    }
    if (payload.status != null) row.status = payload.status

    if (file) {
      const oldStored = row.storedFileName
      const saved = await this.saveUploadedDocx(file)
      row.fileName = saved.fileName
      row.storedFileName = saved.storedFileName
      row.fileUrl = saved.fileUrl
      row.fileSize = saved.fileSize
      row.detectedVariables = saved.detectedVariables
      row.version = (row.version || 1) + 1
      row.uploadedBy = actorId
      const oldPath = await findContractTemplateFilePath(oldStored)
      if (oldPath) {
        try {
          await fs.unlink(oldPath)
        } catch {
          // bỏ qua
        }
      }
    }

    if (payload.isDefault === true) {
      await this.clearOtherDefaults(row.templateType, row.id)
      row.isDefault = true
    } else if (payload.isDefault === false) {
      row.isDefault = false
    }

    await row.save()
    return row
  }

  static async setDefault(id: number) {
    const row = await this.findById(id)
    if (row.status !== 'ACTIVE') throw new Error('TEMPLATE_INACTIVE')
    await this.clearOtherDefaults(row.templateType, row.id)
    row.isDefault = true
    await row.save()
    return row
  }

  static async updateStatus(id: number, status: ContractTemplateStatus) {
    const row = await this.findById(id)
    if (status === 'INACTIVE' && row.isDefault) {
      throw new Error('CANNOT_DISABLE_DEFAULT')
    }
    row.status = status
    await row.save()
    return row
  }

  static async destroy(id: number) {
    const row = await this.findById(id)
    if (row.isDefault) throw new Error('CANNOT_DELETE_DEFAULT')
    const stored = row.storedFileName
    await row.delete()
    const filePath = await findContractTemplateFilePath(stored)
    if (filePath) {
      try {
        await fs.unlink(filePath)
      } catch {
        // bỏ qua
      }
    }
  }

  static async resolveDownloadPath(id: number) {
    const row = await this.findById(id)
    const filePath = await findContractTemplateFilePath(row.storedFileName)
    if (!filePath) throw new Error('FILE_NOT_FOUND')
    return { row, filePath }
  }
}
