/**
 * Đổ dữ liệu thuyết minh (ProjectOutline) → map biến {{...}} mẫu BM-02.02.
 */
import type ProjectOutline from '#models/project_outline'
import type {
  OutlineExpectedResults,
  OutlineFundingBreakdown,
  OutlineHostOrganization,
  OutlineOtherContents,
  OutlinePartnerUnit,
  OutlinePrincipalInfo,
} from '#models/project_outline'
import {
  calcRowComputed,
  normalizeBudgetMatrix,
  OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES,
  OUTLINE_BUDGET_EXPENSE_LABELS,
  type OutlineBudgetMatrix,
} from '#constants/outline_budget_matrix'
import { DateTime } from 'luxon'

function s(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/** Bóc thẻ HTML thô → văn bản thuần (đủ cho merge Word). */
export function htmlSangVanBan(html: string | null | undefined): string {
  if (!html) return ''
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function dinhDangTien(n: number): string {
  const x = Math.round(Number(n) || 0)
  return x.toLocaleString('vi-VN')
}

/** Đọc số tiền Việt Nam đơn giản (đến tỷ). */
export function soTienBangChu(n: number): string {
  const so = Math.round(Number(n) || 0)
  if (so <= 0) return 'không đồng'
  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const docBa = (x: number, dayDu: boolean): string => {
    const tram = Math.floor(x / 100)
    const chuc = Math.floor((x % 100) / 10)
    const donvi = x % 10
    let out = ''
    if (tram > 0 || dayDu) {
      if (tram > 0) out += `${chuSo[tram]} trăm`
      else if (dayDu && (chuc > 0 || donvi > 0)) out += 'không trăm'
    }
    if (chuc > 1) {
      out += (out ? ' ' : '') + `${chuSo[chuc]} mươi`
      if (donvi === 1) out += ' mốt'
      else if (donvi === 5) out += ' lăm'
      else if (donvi > 0) out += ` ${chuSo[donvi]}`
    } else if (chuc === 1) {
      out += (out ? ' ' : '') + 'mười'
      if (donvi === 5) out += ' lăm'
      else if (donvi > 0) out += ` ${chuSo[donvi]}`
    } else if (donvi > 0) {
      if (out) out += ` lẻ ${chuSo[donvi]}`
      else out = chuSo[donvi]!
    }
    return out.trim()
  }
  const ty = Math.floor(so / 1_000_000_000)
  const trieu = Math.floor((so % 1_000_000_000) / 1_000_000)
  const nghin = Math.floor((so % 1_000_000) / 1_000)
  const don = so % 1_000
  const parts: string[] = []
  if (ty) parts.push(`${docBa(ty, false)} tỷ`)
  if (trieu) parts.push(`${docBa(trieu, !!parts.length)} triệu`)
  if (nghin) parts.push(`${docBa(nghin, !!parts.length)} nghìn`)
  if (don || !parts.length) parts.push(docBa(don, !!parts.length))
  return `${parts.join(' ')} đồng`.replace(/\s+/g, ' ').trim()
}

function ngayHienThi(raw: DateTime | string | null | undefined): string {
  if (!raw) return ''
  if (DateTime.isDateTime(raw)) return raw.toFormat('dd/MM/yyyy')
  const t = s(raw)
  if (!t) return ''
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const dt = DateTime.fromISO(t)
  return dt.isValid ? dt.toFormat('dd/MM/yyyy') : t
}

function tick(ok: boolean): string {
  return ok ? '☑' : '☐'
}

function soThangTuNgay(
  start: DateTime | null | undefined,
  end: DateTime | null | undefined
): string {
  if (!start || !end) return ''
  const months = Math.max(1, Math.round(end.diff(start, 'months').months))
  return String(months)
}

function formatBangTienDoTuMilestone(
  milestones: Array<{ content?: string; startDate?: string | null; endDate?: string | null; expectedResult?: string | null }>
): string {
  if (!milestones?.length) return ''
  const lines = [
    'STT | Nội dung công việc | Thời gian | Sản phẩm/kết quả',
    ...milestones.map((m, i) => {
      const tg = [ngayHienThi(m.startDate), ngayHienThi(m.endDate)].filter(Boolean).join(' – ')
      return `${i + 1} | ${s(m.content) || '—'} | ${tg || '—'} | ${s(m.expectedResult) || '—'}`
    }),
  ]
  return lines.join('\n')
}

function formatBangCongBo(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.publications || []
  if (!rows.length) return ''
  const lines = [
    'TT | Bài báo; sách chuyên khảo… | Số lượng | Yêu cầu khoa học | Ghi chú',
    ...rows.map((r, i) => {
      const loai = r.category === 'INTERNATIONAL' ? 'Quốc tế' : r.category === 'DOMESTIC' ? 'Trong nước' : s(r.category)
      return `${i + 1} | [${loai}] ${s(r.content) || '—'} | ${s(r.quantity) || ''} | ${s(r.scienceRequirement) || ''} | ${s(r.note) || ''}`
    }),
  ]
  return lines.join('\n')
}

function formatBangUngDung(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.appliedProducts || []
  if (!rows.length) return ''
  const lines = [
    'TT | Tên sản phẩm | Yêu cầu khoa học | Ghi chú',
    ...rows.map(
      (r, i) => `${i + 1} | ${s(r.name) || '—'} | ${s(r.scienceRequirement) || ''} | ${s(r.note) || ''}`
    ),
  ]
  return lines.join('\n')
}

function formatBangMau(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.tangibleProducts || []
  if (!rows.length) return ''
  const lines = [
    'TT | Tên sản phẩm / chỉ tiêu | Đơn vị | Cần đạt | Mẫu TN | Mẫu TG | Số lượng/quy mô',
    ...rows.map(
      (r, i) =>
        `${i + 1} | ${s(r.name) || '—'} | ${s(r.unit) || ''} | ${s(r.qualityRequired) || ''} | ${s(r.qualitySampleDomestic) || ''} | ${s(r.qualitySampleWorld) || ''} | ${s(r.quantityScale) || ''}`
    ),
  ]
  return lines.join('\n')
}

function formatBangShtt(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.ipProducts || []
  if (!rows.length) return ''
  const lines = [
    'TT | Tên sản phẩm | Yêu cầu khoa học | Ghi chú',
    ...rows.map(
      (r, i) => `${i + 1} | ${s(r.name) || '—'} | ${s(r.scienceRequirement) || ''} | ${s(r.note) || ''}`
    ),
  ]
  return lines.join('\n')
}

function formatBangDaoTao(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.postgraduateTraining || []
  if (!rows.length) return ''
  const lines = [
    'TT | Cấp đào tạo | Số lượng | Chuyên ngành | Ghi chú',
    ...rows.map(
      (r, i) => `${i + 1} | ${s(r.level) || '—'} | ${s(r.quantity) || ''} | ${s(r.major) || ''} | ${s(r.note) || ''}`
    ),
  ]
  return lines.join('\n')
}

function formatBangDuToan(matrix: OutlineBudgetMatrix): string {
  const m = normalizeBudgetMatrix(matrix)
  const sources: Array<{ key: keyof OutlineBudgetMatrix; label: string }> = [
    { key: 'STATE_LUMP', label: 'NSNN — khoán chi' },
    { key: 'STATE_NON_LUMP', label: 'NSNN — không khoán chi' },
    { key: 'NON_STATE', label: 'Ngoài NSNN' },
  ]
  const lines = ['Nguồn | Khoản chi | Số tiền (đồng)']
  let tong = 0
  for (const src of sources) {
    const row = m[src.key]
    const { quanLy, tong: rowTong } = calcRowComputed(row)
    for (const code of OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES) {
      const amount = Math.round(Number(row[code] || 0))
      if (!amount) continue
      lines.push(`${src.label} | ${OUTLINE_BUDGET_EXPENSE_LABELS[code]} | ${dinhDangTien(amount)}`)
    }
    if (quanLy > 0) {
      lines.push(`${src.label} | ${OUTLINE_BUDGET_EXPENSE_LABELS.QUAN_LY} | ${dinhDangTien(quanLy)}`)
    }
    tong += rowTong
  }
  lines.push(`Tổng kinh phí |  | ${dinhDangTien(tong)}`)
  const lump = calcRowComputed(m.STATE_LUMP).tong
  const nonLump = calcRowComputed(m.STATE_NON_LUMP).tong
  const nonState = calcRowComputed(m.NON_STATE).tong
  lines.push(`Trong đó — Kinh phí từ trường (khoán): ${dinhDangTien(lump)}`)
  lines.push(`Trong đó — Kinh phí từ trường (không khoán): ${dinhDangTien(nonLump)}`)
  lines.push(`Trong đó — Kinh phí ngoài trường: ${dinhDangTien(nonState)}`)
  return lines.join('\n')
}

function napToChucPhoiHop(partners: OutlinePartnerUnit[]): Record<string, string> {
  const out: Record<string, string> = {
    danh_sach_to_chuc_phoi_hop: '',
    tcp_1_ten: '',
    tcp_1_ma_so: '',
    tcp_1_dien_thoai: '',
    tcp_1_dia_chi: '',
    tcp_2_ten: '',
    tcp_2_ma_so: '',
    tcp_2_dien_thoai: '',
    tcp_2_dia_chi: '',
    tcp_3_ten: '',
    tcp_3_ma_so: '',
    tcp_3_dien_thoai: '',
    tcp_3_dia_chi: '',
  }
  const list = partners || []
  list.slice(0, 3).forEach((p, idx) => {
    const i = idx + 1
    out[`tcp_${i}_ten`] = s(p.name)
    out[`tcp_${i}_ma_so`] = s(p.orgCode)
    out[`tcp_${i}_dien_thoai`] = s(p.phone)
    out[`tcp_${i}_dia_chi`] = s(p.address)
  })
  out.danh_sach_to_chuc_phoi_hop = list
    .map((p, i) => {
      const bits = [s(p.name), s(p.orgCode) && `Mã: ${s(p.orgCode)}`, s(p.phone) && `ĐT: ${s(p.phone)}`, s(p.address) && `Địa chỉ: ${s(p.address)}`]
        .filter(Boolean)
        .join(' — ')
      return `${i + 1}. ${bits}`
    })
    .join('\n')
  return out
}

/**
 * Xây map biến merge từ bản ghi thuyết minh.
 */
export function buildBm0202MergeData(outline: ProjectOutline): Record<string, string> {
  const now = DateTime.now()
  const fbRaw = outline.fundingBreakdown
  const ngoaiTruongLegacy =
    Number(fbRaw?.externalStateLocal || 0) +
    Number(fbRaw?.externalEnterprise || 0) +
    Number(fbRaw?.externalSponsor || 0) +
    Number(fbRaw?.externalOther || 0)
  const fb: OutlineFundingBreakdown = {
    schoolFund: Number(fbRaw?.schoolFund || 0),
    externalFund: Number(fbRaw?.externalFund || 0) || ngoaiTruongLegacy,
    stateBudget: Number(fbRaw?.stateBudget || 0),
    nonStateBudget: Number(fbRaw?.nonStateBudget || 0),
    lumpSumMode:
      fbRaw?.lumpSumMode === 'FULL' || fbRaw?.lumpSumMode === 'PARTIAL'
        ? fbRaw.lumpSumMode
        : null,
    lumpSumAmount: Number(fbRaw?.lumpSumAmount || 0),
    nonLumpSumAmount: Number(fbRaw?.nonLumpSumAmount || 0),
  }
  const ngoaiTruong = Number(fb.externalFund || 0)

  const matrix = normalizeBudgetMatrix(outline.budgetMatrix)
  const chiKhoanSpCuoi = fb.lumpSumMode === 'FULL'
  const khoanTungPhan = fb.lumpSumMode === 'PARTIAL'
  const kpKhoan = khoanTungPhan
    ? Number(fb.lumpSumAmount || 0)
    : chiKhoanSpCuoi
      ? Number(outline.requestedBudget || 0) ||
        Number(fb.stateBudget || 0) + Number(fb.nonStateBudget || 0)
      : calcRowComputed(matrix.STATE_LUMP).tong
  const kpKhongKhoan = khoanTungPhan
    ? Number(fb.nonLumpSumAmount || 0)
    : calcRowComputed(matrix.STATE_NON_LUMP).tong

  const pi: OutlinePrincipalInfo = outline.principalInfo || {}
  const host: OutlineHostOrganization = outline.hostOrganization || { name: '' }
  const other: OutlineOtherContents = outline.otherContents || {}
  const gender = s(pi.gender).toUpperCase()
  const isNam = gender === 'MALE' || gender === 'NAM' || gender === 'M'
  const isNu = gender === 'FEMALE' || gender === 'NỮ' || gender === 'NU' || gender === 'F'

  const tong = Number(outline.requestedBudget || 0) || Number(fb.stateBudget || 0) + Number(fb.nonStateBudget || 0)

  const data: Record<string, string> = {
    ma_bieu_mau: 'BM-02.02',
    phien_ban: '1.0',
    ngay_lap: String(now.day).padStart(2, '0'),
    thang_lap: String(now.month).padStart(2, '0'),
    nam_lap: String(now.year),

    ten_nhiem_vu: s(outline.title),
    ma_so_nhiem_vu: s(outline.code),
    ten_cum_chuoi: '',
    linh_vuc: s(outline.field),
    cap_quan_ly: s(outline.level),

    to_chuc_chu_tri: s(host.name) || s(outline.hostUnit),
    so_thang: soThangTuNgay(outline.startDate, outline.endDate),
    ngay_bat_dau: ngayHienThi(outline.startDate),
    ngay_ket_thuc: ngayHienThi(outline.endDate),

    tong_kinh_phi: dinhDangTien(tong),
    tong_kinh_phi_bang_chu: soTienBangChu(tong),
    kp_tu_truong: dinhDangTien(fb.schoolFund),
    kp_ngoai_truong: dinhDangTien(ngoaiTruong),
    kp_ngoai_truong_nn_dia_phuong: '',
    kp_ngoai_truong_dn: '',
    kp_ngoai_truong_tai_tro: '',
    kp_ngoai_truong_khac: '',
    kp_nsnn: dinhDangTien(fb.stateBudget),
    kp_ngoai_nsnn: dinhDangTien(fb.nonStateBudget),

    hinh_thuc_khoan_chi: chiKhoanSpCuoi
      ? 'Khoán chi đến sản phẩm cuối cùng'
      : khoanTungPhan
        ? 'Khoán chi từng phần'
        : '',
    tick_khoan_sp_cuoi: tick(chiKhoanSpCuoi),
    tick_khoan_tung_phan: tick(khoanTungPhan),
    kp_khoan: dinhDangTien(kpKhoan),
    kp_khong_khoan: dinhDangTien(kpKhongKhoan),

    cn_ho_ten: s(pi.fullName),
    cn_cccd: s(pi.identityNumber),
    cn_ngay_sinh: ngayHienThi(pi.dateOfBirth),
    cn_gioi_tinh: isNam ? 'Nam' : isNu ? 'Nữ' : s(pi.gender),
    tick_nam: tick(isNam),
    tick_nu: tick(isNu),
    cn_hoc_ham_hoc_vi: s(pi.academicTitleDegree),
    cn_chuc_danh: s(pi.professionalTitle),
    cn_chuc_vu: s(pi.position),
    cn_dien_thoai: s(pi.phone),
    cn_email: s(pi.email),
    cn_to_chuc: s(pi.organization),
    cn_dia_chi_cong_tac: s(pi.workAddress),

    tc_ten: s(host.name) || s(outline.hostUnit),
    tc_ma_so: s(host.orgCode),
    tc_dien_thoai: s(host.phone),
    tc_dia_chi: s(host.address),
    tc_thu_truong: s(host.leaderName),
    tc_nang_luc: htmlSangVanBan(host.experienceHtml),
    tc_doi_ngu: htmlSangVanBan(host.teamCapacityHtml),

    tinh_cap_thiet: htmlSangVanBan(outline.urgency),
    muc_tieu: htmlSangVanBan(outline.detailedObjectives),
    noi_dung_phuong_phap: [htmlSangVanBan(outline.researchContent), htmlSangVanBan(outline.methodology)]
      .filter(Boolean)
      .join('\n\n'),
    bang_tien_do: formatBangTienDoTuMilestone(outline.milestones || []),

    bang_cong_bo: formatBangCongBo(outline.expectedResults),
    bang_san_pham_ung_dung: formatBangUngDung(outline.expectedResults),
    bang_san_pham_mau: formatBangMau(outline.expectedResults),
    bang_shtt: formatBangShtt(outline.expectedResults),
    bang_dao_tao: formatBangDaoTao(outline.expectedResults),

    kha_nang_ung_dung: htmlSangVanBan(other.applicationTransferHtml),
    hieu_qua_dau_ra: htmlSangVanBan(other.outputEffectivenessHtml),
    tac_dong_ket_qua: htmlSangVanBan(other.impactAssessmentHtml),
    bang_du_toan: formatBangDuToan(matrix),
    quan_ly_rui_ro: htmlSangVanBan(other.riskManagementHtml),
    yeu_cau_dao_duc: [htmlSangVanBan(other.ethicsDataApprovalHtml), htmlSangVanBan(other.dataManagementPlanHtml)]
      .filter(Boolean)
      .join('\n\n'),
    yeu_cau_shtt: htmlSangVanBan(other.ipProtectionHtml),
    yeu_cau_ai: htmlSangVanBan(other.aiUsageHtml),
    yeu_cau_dac_thu_khac: '',

    chu_ky_chu_nhiem: s(pi.fullName),
    chu_ky_dai_dien_to_chuc: s(host.leaderName),

    ...napToChucPhoiHop(outline.partnerUnits || []),
  }

  return data
}
