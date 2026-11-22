import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectContract from '#models/project_contract'
import ContractTemplateService from '#services/contract_template_service'
import ProjectOutlineService from '#services/project_outline_service'
import NotificationService from '#services/notification_service'
import { BM06_TEMPLATE_VARIABLE_KEYS } from '#constants/bm06_template_variables'
import {
  DRAFT_FUNDING_KEY,
  DRAFT_MILESTONES_KEY,
  emptyFundingRows,
  chuanHoaThoiGian,
  formatBangNguonKinhPhi,
  formatBangTienDo,
  milestonesFromOutline,
  normalizeFundingRows,
  normalizeMilestoneRows,
  toDdMmYyyy,
  type ContractFundingRow,
  type ContractMilestoneRow,
} from '#constants/contract_draft_form'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import {
  findGeneratedContractFilePath,
  mergeDocxTemplate,
} from '#utils/docx_merge_helper'
import {
  buildSanPhamYeuCauOoxml,
  htmlSangVanBan,
} from '#utils/outline_thuyet_minh_merge'
import { formatVndPlain, numberToVietnameseWords } from '#utils/vietnamese_number_words'
import { mergeBm06Edits } from '#services/module56_rules'
import User from '#models/user'
import PersonalProfile from '#models/personal_profile'
import ScientificProfile from '#models/scientific_profile'
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
      sign_mode: row.signMode || 'ONLINE',
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

  /** Đọc form dự thảo đã lưu / suy từ thuyết minh. */
  static readDraftForm(outline: ProjectOutline, mergePayload?: Record<string, string> | null) {
    const payload = mergePayload || {}
    const budget = Number(outline.approvedBudget ?? outline.confirmedBudget ?? 0)
    let milestones = normalizeMilestoneRows(this.parseJson(payload[DRAFT_MILESTONES_KEY]))
    if (!milestones.length) milestones = milestonesFromOutline(outline.milestones)

    let funding = normalizeFundingRows(this.parseJson(payload[DRAFT_FUNDING_KEY]), budget)
    const tongFromPayload = this.parseMoney(payload.tong_kinh_phi)
    const tong =
      funding.reduce((s, r) => s + r.amount, 0) || tongFromPayload || budget

    const start = outline.startDate
    const end = outline.endDate
    let months = String(payload.so_thang || payload.so_thang_thuc_hien || '').trim()
    if (!months && start && end) {
      months = String(Math.max(1, Math.round(end.diff(start, 'months').months)))
    }

    const ngayBd = toDdMmYyyy(
      payload.ngay_bat_dau || (start ? start.toFormat('dd/MM/yyyy') : '')
    )
    const ngayKt = toDdMmYyyy(
      payload.ngay_ket_thuc || (end ? end.toFormat('dd/MM/yyyy') : '')
    )

    const thoiGianLabel =
      ngayBd || ngayKt ? `${ngayBd || '…'} → ${ngayKt || '…'}` : months ? `${months} tháng` : '—'

    return {
      tenNhiemVu: outline.title || '',
      maSo: outline.code || '',
      cnnv: outline.ownerName || '',
      donVi: outline.hostUnit || outline.ownerUnit || '',
      thoiGian: thoiGianLabel,
      kinhPhi: formatVndPlain(tong),
      soThang: months,
      ngayBatDau: ngayBd,
      ngayKetThuc: ngayKt,
      tongKinhPhi: tong,
      kinhPhiBangChu: numberToVietnameseWords(tong),
      milestones,
      funding,
    }
  }

  /** Áp form dự thảo vào merge_payload (giữ Bên A / biến khác). */
  static applyDraftFormToPayload(
    base: Record<string, string>,
    input: {
      soThang?: string | number | null
      ngayBatDau?: string | null
      ngayKetThuc?: string | null
      tongKinhPhi?: number | null
      milestones?: ContractMilestoneRow[]
      funding?: ContractFundingRow[]
    }
  ): Record<string, string> {
    const next = { ...base }
    const milestones = normalizeMilestoneRows(input.milestones)
    const funding = normalizeFundingRows(input.funding, Number(input.tongKinhPhi) || 0)
    const tongRaw = input.tongKinhPhi
    const tong =
      tongRaw != null && Number.isFinite(Number(tongRaw))
        ? Math.round(Number(tongRaw) || 0)
        : funding.reduce((s, r) => s + r.amount, 0)
    const budgetText = formatVndPlain(tong)
    const budgetWords = numberToVietnameseWords(tong)
    const soThang = String(input.soThang ?? next.so_thang ?? '').trim()
    const ngayBd = toDdMmYyyy(String(input.ngayBatDau ?? next.ngay_bat_dau ?? '').trim())
    const ngayKt = toDdMmYyyy(String(input.ngayKetThuc ?? next.ngay_ket_thuc ?? '').trim())
    const milestonesChuan = milestones.map((m) => ({
      ...m,
      thoiGian: chuanHoaThoiGian(m.thoiGian),
    }))

    next.so_thang = soThang
    next.so_thang_thuc_hien = soThang
    next.ngay_bat_dau = ngayBd
    next.ngay_ket_thuc = ngayKt
    next.tong_kinh_phi = budgetText
    next.kinh_phi_bang_chu = budgetWords
    next.tong_kinh_phi_bang_chu = budgetWords
    next.bang_tien_do = formatBangTienDo(milestonesChuan)
    next.bang_nguon_kinh_phi = formatBangNguonKinhPhi(funding, formatVndPlain)

    const amt = (code: string) => funding.find((f) => f.code === code)?.amount || 0
    next.kinh_phi_nsnn = formatVndPlain(amt('NSNN'))
    next.kinh_phi_nsnn_bang_chu = numberToVietnameseWords(amt('NSNN'))
    next.kinh_phi_nguon_khac = formatVndPlain(amt('NGUON_KHAC'))
    next.kinh_phi_nguon_khac_bang_chu = numberToVietnameseWords(amt('NGUON_KHAC'))

    next[DRAFT_MILESTONES_KEY] = JSON.stringify(milestonesChuan)
    next[DRAFT_FUNDING_KEY] = JSON.stringify(
      funding.map((f) => ({ code: f.code, amount: f.amount }))
    )
    return next
  }

  /** Lấy SĐT / địa chỉ CNNV từ hồ sơ cá nhân → hồ sơ KH → user. */
  static async resolveOwnerContact(outline: ProjectOutline): Promise<{
    phone: string
    address: string
    email: string
  }> {
    const ownerId = outline.ownerId
    let phone = ''
    let address = ''
    let email = (outline.ownerEmail || '').trim()

    if (ownerId) {
      const [personal, sci, user] = await Promise.all([
        PersonalProfile.query().where('user_id', ownerId).first(),
        ScientificProfile.query().where('user_id', ownerId).first(),
        User.find(ownerId),
      ])
      phone = String(personal?.phone || sci?.phone || user?.phone || '').trim()
      address = String(personal?.address || '').trim()
      if (!email) email = String(user?.email || sci?.workEmail || '').trim()
    }

    // Chuẩn hóa SĐT 9 số bắt đầu 3–9 → thêm số 0 đầu
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 9 && /^[3-9]/.test(digits)) phone = `0${digits}`
    else if (digits.length >= 9) phone = digits.startsWith('84') ? `0${digits.slice(2)}` : digits

    return { phone, address, email }
  }

  /** Map dữ liệu thuyết minh → biến BM-02.14 / BM.06 (thiếu để trống). */
  static async buildMergePayload(outline: ProjectOutline): Promise<Record<string, string>> {
    const now = DateTime.now()
    const start = outline.startDate
    const end = outline.endDate
    const budget = Number(outline.approvedBudget ?? outline.confirmedBudget ?? 0)
    const budgetText = formatVndPlain(budget)
    const budgetWords = numberToVietnameseWords(budget)
    const contact = await this.resolveOwnerContact(outline)

    let months = ''
    if (start && end) {
      const m = Math.max(1, Math.round(end.diff(start, 'months').months))
      months = String(m)
    }

    const milestones = milestonesFromOutline(outline.milestones)
    const funding = emptyFundingRows(budget)

    const toChucBenB = outline.hostUnit || outline.ownerUnit || ''
    const ngayBd = start ? start.toFormat('dd/MM/yyyy') : ''
    const ngayKt = end ? end.toFormat('dd/MM/yyyy') : ''

    // Plain fallback — xuất DOCX dùng htmlBlocks / tableBlocks
    const mucTieuPlain = htmlSangVanBan(outline.detailedObjectives || outline.summary)
    const noiDungPlain = [
      htmlSangVanBan(outline.researchContent),
      htmlSangVanBan(outline.methodology),
    ]
      .filter(Boolean)
      .join('\n\n')

    const data: Record<string, string> = {
      so_hop_dong: `HD-${outline.code}`,
      ngay_ky: now.toFormat('dd/MM/yyyy'),
      so_ban: '04',
      so_ban_ben_a: '02',
      so_ban_ben_b: '02',

      ten_nhiem_vu: outline.title || '',
      ma_so_nhiem_vu: outline.code || '',
      muc_tieu: mucTieuPlain,
      noi_dung_thuc_hien: noiDungPlain,
      san_pham_yeu_cau: '',
      bang_tien_do: formatBangTienDo(milestones),
      so_thang: months,
      ngay_bat_dau: ngayBd,
      ngay_ket_thuc: ngayKt,
      phuong_thuc_lua_chon: '',
      co_quan_phe_duyet: '',
      so_qd_phe_duyet: '',
      ngay_qd_phe_duyet: '',

      chu_nhiem: outline.ownerName || '',
      chuc_vu_chu_nhiem: 'Chủ nhiệm nhiệm vụ',
      don_vi_chu_nhiem: outline.ownerUnit || '',
      dien_thoai_chu_nhiem: contact.phone,
      email_chu_nhiem: contact.email || outline.ownerEmail || '',

      ten_ben_a: '',
      he_thong_dai_hoc: '',
      dai_dien_ben_a: '',
      chuc_vu_ben_a: '',
      dia_chi_ben_a: '',
      dien_thoai_ben_a: '',
      email_ben_a: '',
      tai_khoan_ben_a: '',
      ngan_hang_ben_a: '',
      ma_so_thue_ben_a: '',

      to_chuc_ben_b: toChucBenB,
      dai_dien_ben_b: outline.ownerName || '',
      chuc_vu_ben_b: 'Chủ nhiệm nhiệm vụ',
      dia_chi_ben_b: contact.address,
      dien_thoai_ben_b: contact.phone,
      email_ben_b: contact.email || outline.ownerEmail || '',
      so_tai_khoan_ben_b: '',
      ngan_hang_ben_b: '',

      tong_kinh_phi: budgetText,
      kinh_phi_bang_chu: budgetWords,
      bang_nguon_kinh_phi: formatBangNguonKinhPhi(funding, formatVndPlain),

      dia_diem_ky: '',
      thang_ky: String(now.month),
      nam_ky: String(now.year),
      ngay_hieu_luc: now.toFormat('dd/MM/yyyy'),
      so_ban_hop_dong: '04',
      so_ban_moi_ben: '02',
      loai_nhiem_vu: outline.level || 'đề tài',
      can_cu_phe_duyet_giao_nhiem_vu: '',
      so_thang_thuc_hien: months,
      thang_bat_dau: start ? String(start.month) : '',
      nam_bat_dau: start ? String(start.year) : '',
      thang_ket_thuc: end ? String(end.month) : '',
      nam_ket_thuc: end ? String(end.year) : '',
      chuc_vu_dai_dien_ben_a: '',
      ten_ben_b: toChucBenB,
      chuc_vu_dai_dien_ben_b: 'Chủ nhiệm nhiệm vụ',
      tong_kinh_phi_bang_chu: budgetWords,
      hinh_thuc_khoan_chi: '',
      kinh_phi_nsnn: formatVndPlain(funding[0]?.amount || 0),
      kinh_phi_nsnn_bang_chu: numberToVietnameseWords(funding[0]?.amount || 0),
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
      [DRAFT_MILESTONES_KEY]: JSON.stringify(milestones),
      [DRAFT_FUNDING_KEY]: JSON.stringify(
        funding.map((f) => ({ code: f.code, amount: f.amount }))
      ),
    }

    for (const key of BM06_TEMPLATE_VARIABLE_KEYS) {
      if (data[key] === undefined) data[key] = ''
    }
    return data
  }

  private static parseJson(raw: string | undefined) {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  private static parseMoney(raw: string | undefined) {
    if (!raw) return 0
    const n = Number(String(raw).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? Math.round(n) : 0
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

    const fresh = await this.buildMergePayload(outline)
    try {
      const SchoolOrgProfileService = (await import('#services/school_org_profile_service')).default
      Object.assign(fresh, await SchoolOrgProfileService.bm06PartyAVars())
    } catch {
      // Thiếu cấu hình profile trường → giữ trống Bên A
    }
    const mergePayload = mergeBm06Edits(fresh, existing?.mergePayload)
    existing = await this.persistDocx(outline, existing, mergePayload, actorId)

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
          templateId: existing.contractTemplateId,
          contractNo: existing.contractNo,
          version: existing.version,
        }
      )
    }

    if (!opts?.silent) {
      await NotificationService.pushToPermission('project.review', {
        type: 'PROJECT_UPDATE',
        title: 'Đã sinh dự thảo hợp đồng BM.06',
        message: `${outline.code}: ${existing.contractNo || ''} — chờ PKH rà soát`,
        link: `/projects/contracts/${existing.id}`,
      })
      await NotificationService.pushToPermission('project.budget_propose', {
        type: 'PROJECT_UPDATE',
        title: 'Đã sinh dự thảo hợp đồng BM.06',
        message: `${outline.code}: ${existing.contractNo || ''} — chờ PKH rà soát`,
        link: `/projects/contracts/${existing.id}`,
      })
    }

    return {
      row: existing,
      created: !(opts?.forceRegen),
      regenerated: !!opts?.forceRegen,
    }
  }

  /**
   * Ghi lại file DOCX từ payload. Giữ trạng thái hiện tại nếu hợp đồng đã có.
   */
  static async persistDocx(
    outline: ProjectOutline,
    existing: ProjectContract | null,
    mergePayload: Record<string, string>,
    actorId: number | null
  ) {
    const template = await ContractTemplateService.getDefaultActive('HOP_DONG')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')

    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    // Chèn bảng Word thật + HTML editor (mục tiêu / nội dung / sản phẩm)
    const draft = this.readDraftForm(outline, mergePayload)
    const bangTienDo = draft.milestones.map((m, i) => ({
      stt: String(i + 1),
      noiDung: htmlSangVanBan(m.content) || m.content || '',
      thoiGian: chuanHoaThoiGian(m.thoiGian) || '',
      sanPham: htmlSangVanBan(m.sanPham) || m.sanPham || '',
    }))
    const bangNguon = [
      ...draft.funding.map((f) => ({
        nguon: f.label,
        soTien: formatVndPlain(f.amount),
      })),
      {
        nguon: 'Tổng cộng',
        soTien: formatVndPlain(draft.tongKinhPhi),
        dam: true,
      },
    ]

    const htmlBlocks = {
      muc_tieu: outline.detailedObjectives || outline.summary || '',
      noi_dung_thuc_hien: [outline.researchContent, outline.methodology]
        .filter((x) => htmlSangVanBan(x))
        .join(''),
    }
    const tableBlocks = {
      san_pham_yeu_cau: buildSanPhamYeuCauOoxml(outline.expectedResults),
    }

    const merged = await mergeDocxTemplate({
      templatePath,
      data: mergePayload,
      outputFileName: `${outline.code.replace(/[^\w.-]/g, '_')}-${Date.now()}.docx`,
      bangTienDo,
      bangNguonKinhPhi: bangNguon,
      htmlBlocks,
      tableBlocks,
    })

    const fileName = `BM06_${outline.code}_draft_v${existing ? (existing.version || 1) + 1 : 1}.docx`
    const contractNo = mergePayload.so_hop_dong || `HD-${outline.code}`

    if (existing) {
      const oldStored = existing.storedFileName
      existing.contractTemplateId = template.id
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
          // bỏ qua file cũ đã mất
        }
      }
      return existing
    }

    return ProjectContract.create({
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

  static async resolveDownloadPath(id: number) {
    const row = await this.findById(id)
    const filePath = await findGeneratedContractFilePath(row.storedFileName)
    if (!filePath) throw new Error('FILE_NOT_FOUND')
    return { row, filePath }
  }
}
