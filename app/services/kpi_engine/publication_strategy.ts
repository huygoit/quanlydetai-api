import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'

/** So khớp id hồ sơ (Lucid/Postgres có thể trả bigint; 8n === 8 là false nếu không ép). */
function sameNumericId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false
  return Number(a) === Number(b)
}

/** Chuẩn hoá họ tên để khớp hồ sơ với cột tác giả khi thiếu profile_id */
function chuanHoaHoTen(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type PublicationAuthorRow = {
  profileId: number | null
  fullName: string
  isTopAuthor: boolean
  isCorresponding: boolean
  affiliationType: string
  isMultiAffiliationOutsideUdn: boolean
  contributionPercent?: number | null
}

/**
 * QĐ 1883 mục 1.4: sản phẩm khoa học KHÁC (ngoài bài báo mục 1,2,3) — giáo trình, đề tài,
 * sáng kiến, SHTT/chuyển giao, hướng dẫn, khen thưởng… — chia giờ theo % đóng góp.
 * Bài báo (WoS/Scopus, trong nước, kỷ yếu/báo cáo) vẫn dùng công thức n/p (mục 1.2–1.3).
 * Phân loại theo mã catalog QD_R<n> (đồng bộ với FE researchOutputFormSchema).
 */
export function dungChiaTheoPhanTramDongGop(
  leafCode?: string | null,
  ruleKind?: string | null
): boolean {
  const c = String(leafCode ?? '').trim().toUpperCase()
  if (!c) {
    // Không xác định mã: chỉ mục 4 (HĐGSNN) chắc chắn là sản phẩm khác → chia %.
    return (ruleKind ?? '').toUpperCase() === 'HDGSNN_POINTS_TO_HOURS'
  }
  // CHỈ mục 1, 2, 3 dùng công thức n/p (mục 1.2–1.3 QĐ 1883):
  // - Mục 1, 2: bài báo quốc tế WoS/Scopus.
  if (c.startsWith('PUB_WOS_') || c.startsWith('PUB_SCOPUS_')) return false
  // - Mục 1, 2, 3 theo mã QĐ: QD_R2..QD_R13 (2–11 quốc tế, 12–13 báo cáo/tham luận).
  const m = /^QD_R(\d+)/.exec(c)
  const n = m ? Number(m[1]) : null
  if (n != null && n >= 2 && n <= 13) return false
  // Tất cả còn lại (mục 4, 5 và sản phẩm khoa học khác: sách, đề tài, sáng kiến,
  // SHTT, chuyển giao, hướng dẫn, khen thưởng…) → chia theo % đóng góp (điều 1.4).
  return true
}

/**
 * Chọn dòng tác giả tương ứng NCV đang tính giờ: ưu profile_id, sau đó họ tên (chỉ khi chủ bài = profile đang tính), cuối cùng tác giả chính đầu tiên.
 */
function chonTacGiaChoProfile(
  publication: { id: number; ownerProfileId: number },
  authors: PublicationAuthorRow[],
  context: KpiContext,
  warnings: string[]
): PublicationAuthorRow | null {
  const theoProfileId = authors.find(
    (a) => a.profileId != null && sameNumericId(a.profileId, context.profileId)
  )
  if (theoProfileId) return theoProfileId

  if (!sameNumericId(publication.ownerProfileId, context.profileId)) {
    return null
  }

  const tenHoSo = chuanHoaHoTen(context.profileFullName ?? '')
  if (tenHoSo.length >= 2) {
    const trungTen = authors.filter((a) => chuanHoaHoTen(a.fullName) === tenHoSo)
    if (trungTen.length === 1) {
      warnings.push(
        'Tác giả khớp họ tên hồ sơ nhưng chưa gắn profile_id; nên cập nhật bảng tác giả.'
      )
      return trungTen[0]!
    }
    if (trungTen.length > 1) {
      warnings.push(
        `Có ${trungTen.length} tác giả trùng họ tên với hồ sơ; dùng tác giả chính đầu tiên trong nhóm trùng tên.`
      )
      return trungTen.find((a) => a.isTopAuthor) ?? trungTen[0]!
    }
  }

  const mainDau = authors.find((a) => a.isTopAuthor)
  if (mainDau) {
    warnings.push(
      'Chưa gắn profile_id cho chính bạn trên bảng tác giả: tạm dùng tác giả chính đầu tiên để tính giờ (nên gắn profile_id hoặc trùng họ tên hồ sơ).'
    )
    return mainDau
  }

  warnings.push('Không xác định được dòng tác giả của NCV; cần gắn profile_id hoặc họ tên trùng hồ sơ.')
  return authors[0] ?? null
}

/**
 * Hệ số a theo QĐ mục 1.1 (a,b,c) — áp dụng trên **một tập tác giả** đã chọn (caller định nghĩa tập).
 *
 * Cột "Cơ quan công tác" → `affiliation_type`:
 * - Chỉ ĐHĐN (thành viên / trực thuộc ĐHĐN) → `UDN_ONLY`
 * - Ngoài ĐHĐN → `OUTSIDE` / `MIXED`
 *
 * Trên tập đó:
 * - (a) Mọi người chỉ ĐHĐN → a = 2
 * - (b) Vừa có ĐHĐN vừa có ngoài → a = 1,5
 * - (c) Mọi người đều không chỉ ĐHĐN → a = 1
 */
export function compositeAffiliationFactorA(authors: Array<{ affiliationType: string }>): number {
  if (!authors.length) return 1
  const tatCaThuocDhDn = authors.every((a) => a.affiliationType === 'UDN_ONLY')
  const tatCaNgoaiDhDn = authors.every((a) => a.affiliationType === 'OUTSIDE')
  if (tatCaThuocDhDn) return 2
  if (tatCaNgoaiDhDn) return 1
  return 1.5
}

type AExplanation = {
  a: number
  reason: string
}

/** Cách mô tả tập tác giả khi giải thích hệ số a trong lý do trả về. */
type LoaiMoTaTapTinhA = 'toan_bo_tac_gia' | 'tac_gia_lien_he'

function giaiThichHeSoATrenTapTacGia(
  authors: Array<{ affiliationType: string }>,
  loaiMoTa: LoaiMoTaTapTinhA
): AExplanation {
  if (!authors.length) {
    return {
      a: 1,
      reason:
        'Không có tác giả trong tập tính hệ số a, hệ thống dùng mặc định a = 1.',
    }
  }
  const tatCaThuocDhDn = authors.every((a) => a.affiliationType === 'UDN_ONLY')
  const tatCaNgoaiDhDn = authors.every((a) => a.affiliationType === 'OUTSIDE')
  const moTaTapTacGia =
    loaiMoTa === 'tac_gia_lien_he'
      ? 'tập tác giả liên hệ'
      : 'toàn bộ tác giả'

  if (tatCaThuocDhDn) {
    return {
      a: 2,
      reason: `Theo ${moTaTapTacGia}, tất cả đều thuộc đơn vị trong ĐHĐN nên a = 2.`,
    }
  }
  if (tatCaNgoaiDhDn) {
    return {
      a: 1,
      reason: `Theo ${moTaTapTacGia}, tất cả đều ngoài nhóm đơn vị ĐHĐN nên a = 1.`,
    }
  }
  return {
    a: 1.5,
    reason: `Theo ${moTaTapTacGia}, có cả đơn vị trong và ngoài ĐHĐN nên a = 1.5.`,
  }
}

/** Phạm vi tính hệ số a theo cấu hình loại kết quả (cột pham_vi_he_so_a_1883). */
export type PhamViHeSoA1883 = 'authors' | 'chiTacGiaChinh'

/**
 * Bài báo mục 1–2 (phạm vi chiTacGiaChinh): theo QĐ 1883 mục 1.1(a)(b), hệ số a
 * chỉ xét **tập tác giả liên hệ** (isCorresponding), KHÔNG tính tác giả đầu.
 * Không có tác giả liên hệ nào → không áp (a)/(b) → **khoản (c)**: **a = 1**.
 * Phạm vi `authors`: (a)/(b)/(c) trên **toàn bộ** tác giả (mục 3).
 */
export function heSoAQdCongBoMuc12(
  authors: Array<{ isTopAuthor: boolean; isCorresponding: boolean; affiliationType: string }>,
  phamViHeSoA1883: PhamViHeSoA1883
): number {
  return giaiThichHeSoAQdCongBoMuc12(authors, phamViHeSoA1883).a
}

export function giaiThichHeSoAQdCongBoMuc12(
  authors: Array<{ isTopAuthor: boolean; isCorresponding: boolean; affiliationType: string }>,
  phamViHeSoA1883: PhamViHeSoA1883
): AExplanation {
  if (phamViHeSoA1883 === 'authors') {
    // Mục 3 (báo cáo/tham luận): theo QĐ 1883 chỉ có 2 trường hợp, không có mức 1.5.
    // - Tất cả tác giả đều thuộc trường thành viên / đơn vị thuộc - trực thuộc ĐHĐN → a = 2
    // - Còn lại (có bất kỳ tác giả ngoài ĐHĐN) → a = 1
    if (!authors.length) {
      return { a: 1, reason: 'Không có tác giả trong bài — dùng mặc định a = 1.' }
    }
    const tatCaThuocDhDn = authors.every((a) => a.affiliationType === 'UDN_ONLY')
    return tatCaThuocDhDn
      ? {
          a: 2,
          reason: 'Mục 3: tất cả tác giả đều thuộc đơn vị trong ĐHĐN nên a = 2.',
        }
      : {
          a: 1,
          reason:
            'Mục 3: có tác giả ngoài ĐHĐN nên a = 1 (chỉ đạt a = 2 khi toàn bộ tác giả thuộc ĐHĐN).',
        }
  }

  const tapTacGiaLienHe = authors.filter((a) => a.isCorresponding)
  if (tapTacGiaLienHe.length === 0) {
    if (!authors.length) {
      return { a: 1, reason: 'Không có tác giả trong bài — dùng mặc định a = 1.' }
    }
    return {
      a: 1,
      reason:
        'Chưa đánh dấu tác giả liên hệ: theo QĐ 1883 mục 1.1, hệ số a ở mục 1, 2 chỉ xét tác giả liên hệ — không có tác giả liên hệ thì áp khoản (c), a = 1.',
    }
  }
  return giaiThichHeSoATrenTapTacGia(tapTacGiaLienHe, 'tac_gia_lien_he')
}

/** Hệ số c mặc định theo QĐ 1883 khi loại kết quả chưa cấu hình meta.c_map. */
const HE_SO_C_MAC_DINH: Record<string, number> = {
  EXCELLENT: 1.1,
  PASS_ON_TIME: 1.0,
  PASS_LATE: 0.5,
}

/**
 * Hệ số c (rule MULTIPLY_C — nghiệm thu đề tài) theo xếp loại nghiệm thu.
 * Ưu tiên giá trị cấu hình trong danh mục (meta.c_map), fallback mức mặc định.
 */
function heSoCNghiemThu(
  rule: ResearchOutputRule,
  acceptanceGrade: string | null,
  warnings: string[]
): number {
  const grade = (acceptanceGrade ?? '').trim().toUpperCase()
  if (!grade) {
    warnings.push('MULTIPLY_C: thiếu xếp loại nghiệm thu — không tính được hệ số c.')
    return 0
  }
  const cMap = (rule.meta?.c_map ?? null) as Record<string, unknown> | null
  const cCauHinh = cMap ? Number(cMap[grade]) : Number.NaN
  if (Number.isFinite(cCauHinh) && cCauHinh > 0) return cCauHinh
  const cMacDinh = HE_SO_C_MAC_DINH[grade]
  if (cMacDinh != null) {
    warnings.push(
      `MULTIPLY_C: chưa cấu hình hệ số c cho xếp loại ${grade} trong danh mục — tạm dùng mặc định ${cMacDinh}.`
    )
    return cMacDinh
  }
  warnings.push(`MULTIPLY_C: xếp loại nghiệm thu không hợp lệ (${grade}).`)
  return 0
}

function baseHoursFromRule(
  kind: string,
  rule: ResearchOutputRule,
  _authors: Array<{ affiliationType: string }>,
  hdgsnnScore: number | null,
  /** Giữ tham số để mở rộng sau; hiện không dùng trong nhánh B0. */
  _aQuyDinh: number,
  acceptanceGrade: string | null
): { B0: number; warnings: string[] } {
  const warnings: string[] = []
  const k = kind.toUpperCase()
  const hv = rule.hoursValue != null ? Number(rule.hoursValue) : 0

  if (k === 'FIXED') {
    if (hv <= 0) warnings.push('FIXED: hours_value không hợp lệ')
    return { B0: hv, warnings }
  }

  if (k === 'MULTIPLY_A') {
    if (hv <= 0) warnings.push('MULTIPLY_A: hours_value không hợp lệ')
    // B0 luôn là giờ chuẩn trước khi nhân hệ số a (để UI hiển thị đúng B0).
    return { B0: hv, warnings }
  }

  if (k === 'HDGSNN_POINTS_TO_HOURS') {
    const score = hdgsnnScore != null ? Number(hdgsnnScore) : 0
    const perPoint = 600
    if (score <= 0) warnings.push('Thiếu điểm HĐGSNN hợp lệ')
    return { B0: score * perPoint, warnings }
  }

  if (k === 'MULTIPLY_C') {
    if (hv <= 0) warnings.push('MULTIPLY_C: hours_value không hợp lệ')
    // Đề tài nghiệm thu: B0 = giờ chuẩn × hệ số c (theo xếp loại nghiệm thu, cấu hình meta.c_map).
    const c = heSoCNghiemThu(rule, acceptanceGrade, warnings)
    return { B0: Math.round(hv * c * 100) / 100, warnings }
  }

  if (k === 'BONUS_ADD') {
    const bonus = rule.hoursBonus != null ? Number(rule.hoursBonus) : 0
    return { B0: hv + bonus, warnings }
  }

  if (k === 'RANGE_REVENUE') {
    warnings.push('RANGE_REVENUE không áp dụng cho công bố')
    return { B0: 0, warnings }
  }

  warnings.push(`Rule kind ${k} chưa hỗ trợ cho công bố`)
  return { B0: 0, warnings }
}

export function publicationStrategySupports(output: KpiOutput): boolean {
  return output.type === 'PUBLICATION'
}

export async function publicationStrategyCalculate(
  output: KpiOutput,
  context: KpiContext
): Promise<CalculationResult> {
  const warnings: string[] = []
  if (output.type !== 'PUBLICATION') {
    return { hours: 0, points: 0, warnings: ['Output không phải PUBLICATION'] }
  }

  const { publication, authors } = output
  const typeId = publication.researchOutputTypeId

  if (!typeId) {
    warnings.push('Công bố chưa gán loại kết quả NCKH (research_output_type_id)')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id } }
  }

  if (!authors || authors.length === 0) {
    warnings.push('Publication chưa có authors')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id } }
  }

  const tongTacGia = authors.length
  /** 1.2–1.3: n = nhóm tác giả chính = tác giả đầu ∪ tác giả liên hệ (mỗi dòng một người). */
  const tacGiaTrongNhomChinh = authors.filter((a) => a.isTopAuthor || a.isCorresponding)
  let n = tacGiaTrongNhomChinh.length
  /** p luôn là tổng số tác giả của công trình (không phải chỉ số tác giả liên hệ). */
  const p = tongTacGia
  const coTacGiaLienHe = authors.some((a) => a.isCorresponding)
  if (!coTacGiaLienHe) {
    warnings.push(
      'Chưa đánh dấu tác giả liên hệ: nên cập nhật đúng theo bài báo; với phạm vi a theo nhóm chính, hệ thống vẫn xét các dòng đã vào nhóm (đầu ∪ liên hệ).'
    )
  }

  let phamViHeSoA1883: PhamViHeSoA1883 = 'chiTacGiaChinh'
  let leafCode: string | null = null
  // Lùi cảnh báo cấu hình hệ số a đến khi biết a có thực sự tham gia công thức hay không
  // (loại chia % hoặc rule không phải MULTIPLY_A thì không dùng a → không cảnh báo).
  let phamViChuaCauHinh = false
  let phamViLoiDoc = false
  try {
    const cachedType = context.ruleCache?.typeById.get(Number(typeId))
    const type = cachedType ?? (await ResearchOutputType.find(typeId))
    leafCode = type?.code ?? null
    if (type?.phamViHeSoA1883 === 'authors' || type?.phamViHeSoA1883 === 'chiTacGiaChinh') {
      phamViHeSoA1883 = type.phamViHeSoA1883
    } else {
      phamViChuaCauHinh = true
    }
  } catch {
    phamViLoiDoc = true
  }

  // Mục 1.4: sản phẩm KH khác chia theo % đóng góp — không phụ thuộc nhóm tác giả chính (n).
  const dungPhanTram = dungChiaTheoPhanTramDongGop(leafCode, null)

  // Không có tác giả chính (n=0) → công thức n/p không chạy; loại chia % thì bỏ qua ràng buộc này.
  if (n < 1) {
    if (tongTacGia === 1) {
      n = 1
      warnings.push(
        'Chỉ có một tác giả nhưng chưa đánh dấu tác giả chính — tạm dùng n=1 để tính giờ quy đổi.'
      )
    } else if (dungPhanTram) {
      n = 1
    } else {
      warnings.push(
        'Chưa có ai trong nhóm tác giả chính (n≥1): cần ít nhất một tác giả đầu (chính) hoặc tác giả liên hệ — tick đúng trên danh sách tác giả.'
      )
      return { hours: 0, points: 0, warnings, details: { n: 0, p } }
    }
  }
  if (tongTacGia < 1) {
    warnings.push('Danh sách tác giả rỗng')
    return { hours: 0, points: 0, warnings, details: { n, p } }
  }
  if (n > tongTacGia) {
    warnings.push('Số tác giả trong nhóm chính (n) không được lớn hơn tổng số tác giả')
    return { hours: 0, points: 0, warnings, details: { n, p, tongTacGia } }
  }

  const aInfo = giaiThichHeSoAQdCongBoMuc12(authors, phamViHeSoA1883)
  const aQd = aInfo.a

  let rule: ResearchOutputRule
  const cachedRule = context.ruleCache?.ruleByTypeId.get(Number(typeId)) as
    | ResearchOutputRule
    | undefined
  if (cachedRule) {
    rule = cachedRule
  } else {
    try {
      rule = await ResearchOutputRule.query().where('type_id', typeId).firstOrFail()
    } catch {
      warnings.push(`Không tìm thấy rule cho type_id=${typeId}`)
      return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, typeId } }
    }
  }

  const kind = (rule.ruleKind || '').toUpperCase()
  const { B0: rawB0, warnings: w2 } = baseHoursFromRule(
    kind,
    rule,
    authors,
    publication.hdgsnnScore ?? null,
    aQd,
    publication.acceptanceGrade ?? null
  )
  warnings.push(...w2)
  if (rawB0 <= 0) {
    warnings.push('Rule không cho giờ cơ sở hợp lệ (B0 ≤ 0).')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, typeId, ruleKind: kind } }
  }

  const authorForProfile = chonTacGiaChoProfile(publication, authors, context, warnings)
  if (!authorForProfile) {
    warnings.push('Giảng viên không nằm trong danh sách tác giả của bài báo (không khớp profile_id / họ tên)')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, profileId: context.profileId } }
  }

  /**
   * Hệ số a mục 1.1 chỉ nhân vào B0 khi rule là MULTIPLY_A (bảng ghi “× a”).
   * Loại cố định (FIXED), nhân c (MULTIPLY_C), cộng thưởng (BONUS_ADD), HĐGSNN…: B = B0, không có a trong công thức — trả aExcel = null để UI hiển thị NA.
   */
  const coHeSoATrongCongThuc = kind === 'MULTIPLY_A'
  // Chỉ cảnh báo thiếu cấu hình phạm vi hệ số a khi a thực sự tham gia (MULTIPLY_A) và không phải loại chia %.
  if (coHeSoATrongCongThuc && !dungPhanTram) {
    if (phamViLoiDoc) {
      warnings.push(
        'Không đọc được cấu hình phamViHeSoA1883 của loại kết quả: mặc định tính hệ số a theo nhóm tác giả chính — đầu ∪ liên hệ (mục 1–2).'
      )
    } else if (phamViChuaCauHinh) {
      warnings.push(
        'Chưa cấu hình phamViHeSoA1883 cho loại kết quả: mặc định tính hệ số a theo nhóm tác giả chính — đầu ∪ liên hệ (mục 1–2).'
      )
    }
  }
  const aExcel: number | null = coHeSoATrongCongThuc ? aQd : null
  const lyDoHeSoA = coHeSoATrongCongThuc
    ? aInfo.reason
    : `Loại quy tắc ${kind} không áp hệ số a theo đơn vị (mục 1.1); tổng giờ công trình B lấy trực tiếp từ B0.`
  /** Bảng QĐ: với MULTIPLY_A thì B = B0 × a; các loại khác B = B0 (a không tham gia). */
  const aFactor = 1
  const daNhanATrongB0 = kind === 'HDGSNN_POINTS_TO_HOURS'
  const heSoATrongCongThucB = daNhanATrongB0 || !coHeSoATrongCongThuc ? 1 : aQd
  const B = (rawB0 > 0 ? rawB0 : 0) * heSoATrongCongThucB
  // Điểm cơ sở cũng suy từ giờ cơ sở theo tỉ lệ 1 điểm = 600 giờ.
  const rawP0 = rawB0 / 600
  // Điểm quy đổi tổng công trình lấy trực tiếp từ tổng giờ: P = B / 600.
  const P = B / 600

  // Trước đây tác giả "Đơn vị khác" (OUTSIDE) bị trả về 0 giờ/điểm theo mục 1.5.
  // Theo yêu cầu nghiệp vụ mới: vẫn tính giờ/điểm quy đổi cho tác giả OUTSIDE
  // theo công thức chuẩn như các tác giả khác (OUTSIDE thuần không phải đa cơ quan nên không chia đôi).

  /** Thuộc nhóm nhận 1/3 chia đều + phần 2/3 chia p: tác giả đầu (chính) hoặc tác giả liên hệ. */
  const trongNhomChinhTheoQD =
    authorForProfile.isTopAuthor || authorForProfile.isCorresponding
  const isMain = trongNhomChinhTheoQD || tongTacGia === 1

  // Mục 1.4: sản phẩm KH khác (sách, đề tài, sáng kiến…) chia giờ theo % đóng góp.
  let hours: number
  if (dungPhanTram) {
    const pct = authorForProfile.contributionPercent
    const tongPct = authors.reduce(
      (s, a) => s + (a.contributionPercent != null ? Number(a.contributionPercent) : 0),
      0
    )
    const pctHopLe = pct != null && Number(pct) > 0 && Math.abs(tongPct - 100) < 0.01
    if (pctHopLe) {
      hours = B * (Number(pct) / 100)
    } else {
      hours = B / tongTacGia
      warnings.push(
        'Mục 1.4: chưa nhập đủ % đóng góp (tổng các tác giả phải = 100). Tạm chia đều cho các tác giả — cần cập nhật % để tính đúng.'
      )
    }
  } else {
    hours = isMain ? B / (3 * n) + (2 * B) / (3 * p) : (2 * B) / (3 * p)
  }
  let points = 0

  if (authorForProfile.isMultiAffiliationOutsideUdn) {
    hours /= 2
  }
  if (context.isFemale) {
    hours *= 1.2
  }

  hours = Math.round(hours * 100) / 100
  // Điểm phần NCV = giờ/600; giữ 4 chữ số thập phân để không lệch so với P0 nhỏ (vd 0,035).
  points = Math.round((hours / 600) * 10000) / 10000

  return {
    hours,
    points,
    warnings,
    details: {
      publicationId: publication.id,
      typeId,
      B0: rawB0,
      P0: rawP0,
      /** Chỉ có giá trị khi rule là MULTIPLY_A; loại khác để null (UI hiển thị NA). */
      aExcel,
      /** Diễn giải hệ số a (MULTIPLY_A) hoặc lý do không áp dụng a. */
      aReason: lyDoHeSoA,
      /** Luôn 1: sau B = B0×a không nhân thêm theo dòng (theo bảng QĐ chỉ có ×a). */
      aFactor,
      B,
      P,
      n,
      p,
      tongTacGia,
        isTopAuthor: isMain,
      multiAffiliationDivide: authorForProfile.isMultiAffiliationOutsideUdn,
      femaleBonus: context.isFemale ?? false,
      ruleKind: kind,
      /** Dòng tác giả dùng để tính phần NCV (hiển thị preview theo từng tên) */
      matchedFullName: authorForProfile.fullName,
    },
  }
}
