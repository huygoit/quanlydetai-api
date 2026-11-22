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
  addExpenseRows,
  calcRowComputed,
  calcRowTotal,
  normalizeBudgetMatrix,
  OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER,
  OUTLINE_BUDGET_EXPENSE_WORD_HEADERS,
  OUTLINE_BUDGET_SOURCE_ROWS,
  type OutlineBudgetExpenseCode,
  type OutlineBudgetMatrix,
} from '#constants/outline_budget_matrix'
import { xmlBangTuDuLieu, type OBangTuyChinh } from '#utils/docx_merge_helper'
import { DateTime } from 'luxon'

function s(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/** Tên riêng / tên tổ chức trên Word — luôn in hoa (vi-VN). */
function inHoa(v: unknown): string {
  const t = s(v)
  return t ? t.toLocaleUpperCase('vi-VN') : ''
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

function oDam(text: string, canGiua = false, nen?: string): OBangTuyChinh {
  return { text, dam: true, canGiua, nen }
}

/** Bảng tiến độ (§11) — Word thật. */
export function xmlBangTienDoOutline(
  milestones: Array<{
    content?: string
    startDate?: string | null
    endDate?: string | null
    expectedResult?: string | null
  }>
): string {
  return xmlBangTuDuLieu({
    headers: ['STT', 'Nội dung công việc', 'Thời gian thực hiện', 'Sản phẩm / kết quả'],
    colWidths: [700, 3800, 2200, 2654],
    emptyText: 'Chưa có tiến độ.',
    rows: (milestones || []).map((m, i) => {
      const tg = [ngayHienThi(m.startDate), ngayHienThi(m.endDate)].filter(Boolean).join(' – ')
      return [
        String(i + 1),
        htmlSangVanBan(m.content) || '—',
        tg || '—',
        htmlSangVanBan(m.expectedResult) || '—',
      ]
    }),
  })
}

export function xmlBangCongBo(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.publications || []
  return xmlBangTuDuLieu({
    headers: ['TT', 'Bài báo; sách chuyên khảo…', 'Số lượng', 'Yêu cầu khoa học', 'Ghi chú'],
    colWidths: [600, 3600, 1100, 2300, 1754],
    emptyText: 'Chưa có công bố khoa học.',
    rows: rows.map((r, i) => {
      const loai =
        r.category === 'INTERNATIONAL'
          ? 'Quốc tế'
          : r.category === 'DOMESTIC'
            ? 'Trong nước'
            : s(r.category)
      const noiDung = [loai && `[${loai}]`, htmlSangVanBan(r.content) || '—'].filter(Boolean).join(' ')
      return [
        String(i + 1),
        noiDung,
        s(r.quantity),
        htmlSangVanBan(r.scienceRequirement),
        htmlSangVanBan(r.note),
      ]
    }),
  })
}

export function xmlBangUngDung(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.appliedProducts || []
  return xmlBangTuDuLieu({
    headers: ['TT', 'Tên sản phẩm', 'Yêu cầu khoa học', 'Ghi chú'],
    colWidths: [600, 3200, 3200, 2354],
    emptyText: 'Chưa có sản phẩm ứng dụng.',
    rows: rows.map((r, i) => [
      String(i + 1),
      htmlSangVanBan(r.name) || '—',
      htmlSangVanBan(r.scienceRequirement),
      htmlSangVanBan(r.note),
    ]),
  })
}

export function xmlBangMau(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.tangibleProducts || []
  return xmlBangTuDuLieu({
    headers: [
      'TT',
      'Tên sản phẩm / chỉ tiêu',
      'Đơn vị',
      'Cần đạt',
      'Mẫu trong nước',
      'Mẫu thế giới',
      'Số lượng / quy mô',
    ],
    colWidths: [500, 2200, 900, 1400, 1400, 1400, 1554],
    emptyText: 'Chưa có sản phẩm mẫu / thiết bị.',
    rows: rows.map((r, i) => [
      String(i + 1),
      htmlSangVanBan(r.name) || '—',
      s(r.unit),
      htmlSangVanBan(r.qualityRequired),
      htmlSangVanBan(r.qualitySampleDomestic),
      htmlSangVanBan(r.qualitySampleWorld),
      s(r.quantityScale),
    ]),
  })
}

export function xmlBangShtt(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.ipProducts || []
  return xmlBangTuDuLieu({
    headers: ['TT', 'Tên sản phẩm', 'Yêu cầu khoa học', 'Ghi chú'],
    colWidths: [600, 3200, 3200, 2354],
    emptyText: 'Chưa có đăng ký SHTT.',
    rows: rows.map((r, i) => [
      String(i + 1),
      htmlSangVanBan(r.name) || '—',
      htmlSangVanBan(r.scienceRequirement),
      htmlSangVanBan(r.note),
    ]),
  })
}

export function xmlBangDaoTao(er: OutlineExpectedResults | null | undefined): string {
  const rows = er?.postgraduateTraining || []
  return xmlBangTuDuLieu({
    headers: ['TT', 'Cấp đào tạo', 'Số lượng', 'Chuyên ngành', 'Ghi chú'],
    colWidths: [600, 2000, 1100, 2800, 2854],
    emptyText: 'Chưa có đào tạo sau đại học.',
    rows: rows.map((r, i) => [
      String(i + 1),
      s(r.level) || '—',
      s(r.quantity),
      s(r.major),
      htmlSangVanBan(r.note),
    ]),
  })
}

/** Tiêu đề mục nhỏ trước bảng sản phẩm (hợp đồng / thuyết minh). */
function xmlTieuDeMuc(tieuDe: string) {
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${thoatXmlTieuDe(tieuDe)}</w:t></w:r></w:p>`
}

function thoatXmlTieuDe(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * §6 Hợp đồng — chỉ xuất các bảng có dữ liệu (giống thuyết minh BM-02.02).
 * Trả về chuỗi OOXML (tiêu đề + bảng) để chèn tại {{san_pham_yeu_cau}}.
 */
export function buildSanPhamYeuCauOoxml(
  er: OutlineExpectedResults | null | undefined
): string {
  const parts: string[] = []
  const pubs = er?.publications || []
  const ungDung = er?.appliedProducts || []
  const mau = er?.tangibleProducts || []
  const shtt = er?.ipProducts || []
  const daoTao = er?.postgraduateTraining || []

  if (pubs.length) {
    parts.push(xmlTieuDeMuc('Công bố khoa học'))
    parts.push(xmlBangCongBo(er))
  }
  if (ungDung.length) {
    parts.push(
      xmlTieuDeMuc('Nguyên lý, phương pháp, tiêu chuẩn, phần mềm & sản phẩm khác')
    )
    parts.push(xmlBangUngDung(er))
  }
  if (mau.length) {
    parts.push(xmlTieuDeMuc('Mẫu, sản phẩm hàng hóa, vật liệu, thiết bị, giống…'))
    parts.push(xmlBangMau(er))
  }
  if (shtt.length) {
    parts.push(xmlTieuDeMuc('Đăng ký bảo hộ quyền sở hữu trí tuệ / công nghiệp'))
    parts.push(xmlBangShtt(er))
  }
  if (daoTao.length) {
    parts.push(xmlTieuDeMuc('Kết quả tham gia đào tạo sau đại học'))
    parts.push(xmlBangDaoTao(er))
  }

  if (!parts.length) {
    return `<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>Chưa có sản phẩm / kết quả dự kiến.</w:t></w:r></w:p>`
  }
  return parts.join('')
}

function tienO(n: number, dam = false, nen?: string): OBangTuyChinh {
  return {
    text: n > 0 ? dinhDangTien(n) : '—',
    dam,
    canGiua: true,
    nen,
  }
}

/**
 * Bảng dự toán §15 — cùng layout FE BudgetMatrixTable:
 * dòng = nguồn (Tổng / NSNN / a·b / ngoài NSNN), cột = khoản chi 4→15.
 */
export function xmlBangDuToan(matrix: OutlineBudgetMatrix): string {
  const m = normalizeBudgetMatrix(matrix)
  const lump = calcRowTotal(m.STATE_LUMP)
  const nonLump = calcRowTotal(m.STATE_NON_LUMP)
  const nonState = calcRowTotal(m.NON_STATE)
  const stateMerged = calcRowTotal(addExpenseRows(m.STATE_LUMP, m.STATE_NON_LUMP))
  const totalMerged = calcRowTotal(
    addExpenseRows(addExpenseRows(m.STATE_LUMP, m.STATE_NON_LUMP), m.NON_STATE)
  )

  const byKey: Record<
    string,
    { amounts: Record<OutlineBudgetExpenseCode, number>; tong: number }
  > = {
    TOTAL: totalMerged,
    STATE: stateMerged,
    STATE_LUMP: lump,
    STATE_NON_LUMP: nonLump,
    NON_STATE: nonState,
  }

  const emptyAmounts = {} as Record<OutlineBudgetExpenseCode, number>
  for (const code of OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER) emptyAmounts[code] = 0

  const headers = [
    'STT',
    'Nguồn kinh phí',
    'Tổng số',
    ...OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map((code) => {
      const h = OUTLINE_BUDGET_EXPENSE_WORD_HEADERS[code]
      return h.hint ? `${h.colNo}. ${h.label}\n(${h.hint})` : `${h.colNo}. ${h.label}`
    }),
  ]

  const rows: Array<Array<string | OBangTuyChinh>> = OUTLINE_BUDGET_SOURCE_ROWS.map((meta) => {
    const nen =
      meta.kind === 'total'
        ? 'D6EAF8'
        : meta.kind === 'group'
          ? 'E8F8E0'
          : meta.kind === 'header'
            ? 'F5F5F5'
            : undefined
    const dam = meta.kind === 'total' || meta.kind === 'group' || meta.kind === 'header'
    const pad = '  '.repeat(meta.indent || 0)

    if (meta.kind === 'header') {
      return [
        oDam('', true, nen),
        oDam(`${pad}${meta.label}`, false, nen),
        oDam('', true, nen),
        ...OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map(() => oDam('', true, nen)),
      ]
    }

    const computed = byKey[meta.key] || { amounts: emptyAmounts, tong: 0 }
    return [
      { text: meta.stt, dam, canGiua: true, nen },
      { text: `${pad}${meta.label}`, dam, canGiua: false, nen },
      tienO(computed.tong, true, nen),
      ...OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map((code) =>
        tienO(computed.amounts[code] || 0, dam && meta.kind === 'total', nen)
      ),
    ]
  })

  // STT + nguồn rộng hơn; tổng số; 12 cột khoản chia đều phần còn lại (~A4 ngang)
  const tongRong = 15840
  const sttW = 500
  const nguonW = 2200
  const tongW = 1100
  const conLai = tongRong - sttW - nguonW - tongW
  const khoanW = Math.floor(conLai / OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.length)
  const cot = [
    sttW,
    nguonW,
    tongW,
    ...OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map((_, i, arr) =>
      i === arr.length - 1 ? conLai - khoanW * (arr.length - 1) : khoanW
    ),
  ]

  return xmlBangTuDuLieu({
    headers,
    rows,
    colWidths: cot,
    centerCols: [0, 2, ...OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map((_, i) => i + 3)],
    coChu: 16,
    nenTieuDe: 'BDD7EE',
    emptyText: 'Chưa có dự toán.',
  })
}

/** Map XML bảng theo tên biến merge BM-02.02. */
export function buildBm0202TableBlocks(outline: ProjectOutline): Record<string, string> {
  const er = outline.expectedResults
  const matrix = normalizeBudgetMatrix(outline.budgetMatrix)
  return {
    bang_tien_do: xmlBangTienDoOutline(outline.milestones || []),
    bang_cong_bo: xmlBangCongBo(er),
    bang_san_pham_ung_dung: xmlBangUngDung(er),
    bang_san_pham_mau: xmlBangMau(er),
    bang_shtt: xmlBangShtt(er),
    bang_dao_tao: xmlBangDaoTao(er),
    bang_du_toan: xmlBangDuToan(matrix),
  }
}

/** Chỉ đổ 8.1 / 8.2 theo mẫu BM-02.02 (không có tổ chức 3). */
function napToChucPhoiHop(partners: OutlinePartnerUnit[]): Record<string, string> {
  const out: Record<string, string> = {
    tcp_1_ten: '',
    tcp_1_ma_so: '',
    tcp_1_dien_thoai: '',
    tcp_1_dia_chi: '',
    tcp_2_ten: '',
    tcp_2_ma_so: '',
    tcp_2_dien_thoai: '',
    tcp_2_dia_chi: '',
  }
  const list = partners || []
  list.slice(0, 2).forEach((p, idx) => {
    const i = idx + 1
    out[`tcp_${i}_ten`] = inHoa(p.name)
    out[`tcp_${i}_ma_so`] = s(p.orgCode)
    out[`tcp_${i}_dien_thoai`] = s(p.phone)
    out[`tcp_${i}_dia_chi`] = s(p.address)
  })
  return out
}

/** Các biến merge lấy từ HTML editor — xuất Word giữ đậm/nghiêng/danh sách. */
export const BM0202_HTML_FIELD_KEYS = [
  'tc_nang_luc',
  'tc_doi_ngu',
  'tinh_cap_thiet',
  'muc_tieu',
  'noi_dung_phuong_phap',
  'kha_nang_ung_dung',
  'hieu_qua_dau_ra',
  'tac_dong_ket_qua',
  'quan_ly_rui_ro',
  'yeu_cau_dao_duc',
  'yeu_cau_shtt',
  'yeu_cau_ai',
  'yeu_cau_dac_thu_khac',
] as const

export type Bm0202HtmlFieldKey = (typeof BM0202_HTML_FIELD_KEYS)[number]

/** Map HTML gốc theo tên biến — dùng khi xuất DOCX. */
export function buildBm0202HtmlBlocks(
  outline: ProjectOutline
): Record<Bm0202HtmlFieldKey, string> {
  const host: OutlineHostOrganization = outline.hostOrganization || { name: '' }
  const other: OutlineOtherContents = outline.otherContents || {}
  return {
    tc_nang_luc: host.experienceHtml || '',
    tc_doi_ngu: host.teamCapacityHtml || '',
    tinh_cap_thiet: outline.urgency || '',
    muc_tieu: outline.detailedObjectives || '',
    noi_dung_phuong_phap: [outline.researchContent, outline.methodology]
      .filter((x) => s(htmlSangVanBan(x)))
      .join(''),
    kha_nang_ung_dung: other.applicationTransferHtml || '',
    hieu_qua_dau_ra: other.outputEffectivenessHtml || '',
    tac_dong_ket_qua: other.impactAssessmentHtml || '',
    quan_ly_rui_ro: other.riskManagementHtml || '',
    yeu_cau_dao_duc: [other.ethicsDataApprovalHtml, other.dataManagementPlanHtml]
      .filter((x) => s(htmlSangVanBan(x)))
      .map((x) => String(x))
      .join(''),
    yeu_cau_shtt: other.ipProtectionHtml || '',
    yeu_cau_ai: other.aiUsageHtml || '',
    yeu_cau_dac_thu_khac: '',
  }
}

/**
 * Xây map biến merge từ bản ghi thuyết minh.
 * Các trường HTML chỉ đặt plain-text fallback; xuất DOCX nên dùng htmlBlocks.
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

  // Tên chủ nhiệm / tổ chức chủ trì — luôn đổ biến + in hoa
  const tenChuNhiemTuTv = (outline.members || []).find(
    (m) => String(m.role || '').toUpperCase() === 'PRINCIPAL'
  )?.fullName
  const tenChuNhiem = inHoa(s(pi.fullName) || s(tenChuNhiemTuTv))
  const tenToChuc = inHoa(s(host.name) || s(outline.hostUnit))

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

    to_chuc_chu_tri: tenToChuc,
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

    cn_ho_ten: tenChuNhiem,
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
    cn_to_chuc: inHoa(pi.organization) || tenToChuc,
    cn_dia_chi_cong_tac: s(pi.workAddress),

    tc_ten: tenToChuc,
    tc_ma_so: s(host.orgCode),
    tc_dien_thoai: s(host.phone),
    tc_dia_chi: s(host.address),
    tc_thu_truong: inHoa(host.leaderName),
    tc_nang_luc: htmlSangVanBan(host.experienceHtml),
    tc_doi_ngu: htmlSangVanBan(host.teamCapacityHtml),

    tinh_cap_thiet: htmlSangVanBan(outline.urgency),
    muc_tieu: htmlSangVanBan(outline.detailedObjectives),
    noi_dung_phuong_phap: [htmlSangVanBan(outline.researchContent), htmlSangVanBan(outline.methodology)]
      .filter(Boolean)
      .join('\n\n'),
    // Các bang_* để trống — xuất DOCX dùng buildBm0202TableBlocks (bảng Word thật)
    bang_tien_do: '',
    bang_cong_bo: '',
    bang_san_pham_ung_dung: '',
    bang_san_pham_mau: '',
    bang_shtt: '',
    bang_dao_tao: '',
    bang_du_toan: '',

    kha_nang_ung_dung: htmlSangVanBan(other.applicationTransferHtml),
    hieu_qua_dau_ra: htmlSangVanBan(other.outputEffectivenessHtml),
    tac_dong_ket_qua: htmlSangVanBan(other.impactAssessmentHtml),
    quan_ly_rui_ro: htmlSangVanBan(other.riskManagementHtml),
    yeu_cau_dao_duc: [htmlSangVanBan(other.ethicsDataApprovalHtml), htmlSangVanBan(other.dataManagementPlanHtml)]
      .filter(Boolean)
      .join('\n\n'),
    yeu_cau_shtt: htmlSangVanBan(other.ipProtectionHtml),
    yeu_cau_ai: htmlSangVanBan(other.aiUsageHtml),
    yeu_cau_dac_thu_khac: '',

    // Chữ ký cuối TM — hỗ trợ cả tên biến cũ và mới trên mẫu
    chu_ky_chu_nhiem: tenChuNhiem,
    chu_ky_dai_dien_to_chuc: inHoa(host.leaderName),
    ten_chu_nhiem: tenChuNhiem,
    ten_dai_dien_to_chuc: inHoa(host.leaderName),

    ...napToChucPhoiHop(outline.partnerUnits || []),
  }

  return data
}
