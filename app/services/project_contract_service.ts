import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectContract from '#models/project_contract'
import ContractTemplateService from '#services/contract_template_service'
import ProjectOutlineService from '#services/project_outline_service'
import NotificationService from '#services/notification_service'
import { BM06_TEMPLATE_VARIABLE_KEYS } from '#constants/bm06_template_variables'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import {
  findGeneratedContractFilePath,
  mergeDocxTemplate,
} from '#utils/docx_merge_helper'
import { formatVndPlain, numberToVietnameseWords } from '#utils/vietnamese_number_words'
import fs from 'node:fs/promises'

/**
 * US-05-01 bước 1 — tự sinh dự thảo BM.06 từ mẫu mặc định loại HOP_DONG.
 */
export default class ProjectContractService {
  static serialize(row: ProjectContract, outline?: ProjectOutline | null) {
    return {
      id: row.id,
      project_outline_id: row.projectOutlineId,
      contract_template_id: row.contractTemplateId,
      status: row.status,
      contract_no: row.contractNo,
      file_name: row.fileName,
      stored_file_name: row.storedFileName,
      file_url: row.fileUrl,
      file_size: row.fileSize,
      merge_payload: row.mergePayload || {},
      version: row.version,
      generated_by: row.generatedBy,
      generated_at: row.generatedAt?.toISO() ?? null,
      note: row.note,
      created_at: row.createdAt?.toISO() ?? null,
      updated_at: row.updatedAt?.toISO() ?? null,
      outline: outline
        ? {
            id: outline.id,
            code: outline.code,
            title: outline.title,
            status: outline.status,
            owner_name: outline.ownerName,
            owner_unit: outline.ownerUnit,
            approved_budget: outline.approvedBudget == null ? null : Number(outline.approvedBudget),
            module5_opened: !!outline.module5Opened,
          }
        : undefined,
    }
  }

  /** Map dữ liệu thuyết minh → biến BM.06 (thiếu để trống). */
  static buildMergePayload(outline: ProjectOutline): Record<string, string> {
    const now = DateTime.now()
    const start = outline.startDate
    const end = outline.endDate
    const budget = Number(outline.approvedBudget ?? outline.confirmedBudget ?? 0)
    const budgetText = formatVndPlain(budget)
    const budgetWords = numberToVietnameseWords(budget)

    let months = ''
    if (start && end) {
      const m = Math.max(1, Math.round(end.diff(start, 'months').months))
      months = String(m)
    }

    const data: Record<string, string> = {
      dia_diem_ky: '',
      ngay_ky: String(now.day),
      thang_ky: String(now.month),
      nam_ky: String(now.year),
      ngay_hieu_luc: now.toFormat('dd/MM/yyyy'),
      so_hop_dong: `HD-${outline.code}`,
      so_ban_hop_dong: '04',
      so_ban_moi_ben: '02',

      loai_nhiem_vu: outline.level || 'đề tài',
      ten_nhiem_vu: outline.title || '',
      can_cu_phe_duyet_giao_nhiem_vu: '',
      so_thang_thuc_hien: months,
      thang_bat_dau: start ? String(start.month) : '',
      nam_bat_dau: start ? String(start.year) : '',
      thang_ket_thuc: end ? String(end.month) : '',
      nam_ket_thuc: end ? String(end.year) : '',

      ten_ben_a: '',
      dai_dien_ben_a: '',
      chuc_vu_dai_dien_ben_a: '',
      dia_chi_ben_a: '',
      dien_thoai_ben_a: '',
      email_ben_a: '',

      ten_ben_b: outline.hostUnit || outline.ownerUnit || '',
      dai_dien_ben_b: outline.ownerName || '',
      chuc_vu_dai_dien_ben_b: 'Chủ nhiệm nhiệm vụ',
      dia_chi_ben_b: '',
      dien_thoai_ben_b: '',
      email_ben_b: outline.ownerEmail || '',
      so_tai_khoan_ben_b: '',
      ngan_hang_ben_b: '',

      hinh_thuc_khoan_chi: '',
      tong_kinh_phi: budgetText,
      tong_kinh_phi_bang_chu: budgetWords,
      kinh_phi_nsnn: budgetText,
      kinh_phi_nsnn_bang_chu: budgetWords,
      kinh_phi_khoan: '',
      kinh_phi_khoan_bang_chu: '',
      kinh_phi_khong_giao_khoan: '',
      kinh_phi_khong_giao_khoan_bang_chu: '',
      kinh_phi_nguon_khac: '0',
      kinh_phi_nguon_khac_bang_chu: numberToVietnameseWords(0),

      ty_le_boi_hoan_loi_khach_quan_khong_dat: '',
      ty_le_boi_hoan_loi_chu_quan_khong_dat: '',
      ty_le_boi_hoan_loi_khach_quan_dinh_chi: '',
      ty_le_boi_hoan_loi_chu_quan_dinh_chi: '',
      dieu_khoan_giai_quyet_tranh_chap: '',
    }

    // Đảm bảo mọi key BM.06 có mặt
    for (const key of BM06_TEMPLATE_VARIABLE_KEYS) {
      if (data[key] === undefined) data[key] = ''
    }
    return data
  }

  static async list(filters: {
    page?: number
    perPage?: number
    status?: string
    keyword?: string
  }) {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 100)
    const q = ProjectContract.query().preload('outline').orderBy('id', 'desc')
    if (filters.status) q.where('status', filters.status)
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('contract_no', `%${filters.keyword}%`).orWhereHas(
          'outline',
          (oq) => {
            oq.whereILike('code', `%${filters.keyword}%`).orWhereILike(
              'title',
              `%${filters.keyword}%`
            )
          }
        )
      })
    }
    return q.paginate(page, perPage)
  }

  static async findById(id: number) {
    const row = await ProjectContract.query().where('id', id).preload('outline').first()
    if (!row) throw new Error('CONTRACT_NOT_FOUND')
    return row
  }

  static async findByOutlineId(outlineId: number) {
    return ProjectContract.query()
      .where('project_outline_id', outlineId)
      .preload('outline')
      .first()
  }

  /**
   * Sinh hoặc trả về dự thảo đã có.
   * @param forceRegen chỉ khi còn HOP_DONG_DRAFT
   */
  static async generateDraft(
    outline: ProjectOutline,
    actorId: number | null,
    opts?: { forceRegen?: boolean; silent?: boolean }
  ) {
    if (!outline.module5Opened && outline.status !== 'SAN_SANG_THUC_HIEN') {
      throw new Error('OUTLINE_NOT_READY')
    }

    let existing = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .first()

    if (existing && !opts?.forceRegen) {
      return { row: existing, created: false, regenerated: false }
    }
    if (existing && opts?.forceRegen && existing.status !== 'HOP_DONG_DRAFT') {
      throw new Error('CANNOT_REGEN')
    }

    const template = await ContractTemplateService.getDefaultActive('HOP_DONG')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')

    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    const mergePayload = this.buildMergePayload(outline)
    const merged = await mergeDocxTemplate({
      templatePath,
      data: mergePayload,
      outputFileName: `${outline.code.replace(/[^\w.-]/g, '_')}-${Date.now()}.docx`,
    })

    const fileName = `BM06_${outline.code}_draft_v${existing ? (existing.version || 1) + 1 : 1}.docx`
    const contractNo = mergePayload.so_hop_dong || `HD-${outline.code}`

    if (existing) {
      const oldStored = existing.storedFileName
      existing.contractTemplateId = template.id
      existing.status = 'HOP_DONG_DRAFT'
      existing.contractNo = contractNo
      existing.fileName = fileName
      existing.storedFileName = merged.storedFileName
      existing.fileUrl = merged.fileUrl
      existing.fileSize = merged.fileSize
      existing.mergePayload = mergePayload
      existing.version = (existing.version || 1) + 1
      existing.generatedBy = actorId
      existing.generatedAt = DateTime.now()
      await existing.save()

      const oldPath = await findGeneratedContractFilePath(oldStored)
      if (oldPath) {
        try {
          await fs.unlink(oldPath)
        } catch {
          // bỏ qua
        }
      }
    } else {
      existing = await ProjectContract.create({
        projectOutlineId: outline.id,
        contractTemplateId: template.id,
        status: 'HOP_DONG_DRAFT',
        contractNo,
        fileName,
        storedFileName: merged.storedFileName,
        fileUrl: merged.fileUrl,
        fileSize: merged.fileSize,
        mergePayload,
        version: 1,
        generatedBy: actorId,
        generatedAt: DateTime.now(),
      })
    }

    outline.activeContractId = existing.id
    outline.contractStatus = 'HOP_DONG_DRAFT'
    await outline.save()

    if (actorId != null) {
      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        opts?.forceRegen ? 'CONTRACT_DRAFT_REGENERATED' : 'CONTRACT_DRAFT_GENERATED',
        outline.status,
        outline.status,
        {
          contractId: existing.id,
          templateId: template.id,
          contractNo,
          version: existing.version,
        }
      )
    }

    if (!opts?.silent) {
      await NotificationService.pushToPermission('project.review', {
        type: 'PROJECT_UPDATE',
        title: 'Đã sinh dự thảo hợp đồng BM.06',
        message: `${outline.code}: ${contractNo} — chờ PKH rà soát`,
        link: `/projects/contracts/${existing.id}`,
      })
      await NotificationService.pushToPermission('project.budget_propose', {
        type: 'PROJECT_UPDATE',
        title: 'Đã sinh dự thảo hợp đồng BM.06',
        message: `${outline.code}: ${contractNo} — chờ PKH rà soát`,
        link: `/projects/contracts/${existing.id}`,
      })
    }

    return {
      row: existing,
      created: !(opts?.forceRegen),
      regenerated: !!opts?.forceRegen,
    }
  }

  static async resolveDownloadPath(id: number) {
    const row = await this.findById(id)
    const filePath = await findGeneratedContractFilePath(row.storedFileName)
    if (!filePath) throw new Error('FILE_NOT_FOUND')
    return { row, filePath }
  }
}
