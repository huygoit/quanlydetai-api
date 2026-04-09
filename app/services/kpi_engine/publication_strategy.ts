import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'
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
  isMainAuthor: boolean
  isCorresponding: boolean
  affiliationType: string
  isMultiAffiliationOutsideUdn: boolean
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
      return trungTen.find((a) => a.isMainAuthor) ?? trungTen[0]!
    }
  }

  const mainDau = authors.find((a) => a.isMainAuthor)
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
  const laDaiHocDaNang = (a: { affiliationType: string }) => a.affiliationType === 'UDN_ONLY'
  const tatCaThuocDhDn = authors.every(laDaiHocDaNang)
  const tatCaLaKhac = authors.every((a) => !laDaiHocDaNang(a))
  if (tatCaThuocDhDn) return 2
  if (tatCaLaKhac) return 1
  return 1.5
}

/**
 * Bài báo mục 1,2: hệ số a nhìn **tất cả tác giả liên hệ** (cơ quan công tác thể hiện trên bài).
 * Chưa có tác giả liên hệ xác định → coi như mục 3: xét **toàn bộ** tác giả (1.1 áp trên cả nhóm).
 */
export function heSoAQdCongBoMuc12(
  authors: Array<{ isCorresponding: boolean; affiliationType: string }>
): number {
  const chiLienHe = authors.filter((a) => a.isCorresponding)
  const tapDeTinhA = chiLienHe.length > 0 ? chiLienHe : authors
  return compositeAffiliationFactorA(tapDeTinhA)
}

function baseHoursFromRule(
  kind: string,
  rule: ResearchOutputRule,
  authors: Array<{ affiliationType: string }>,
  hdgsnnScore: number | null,
  /** Hệ số a mục 1.1 (đã suy từ tác giả liên hệ hoặc toàn bài) — dùng cho MULTIPLY_A */
  aQuyDinh: number
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
    return { B0: hv * aQuyDinh, warnings }
  }

  if (k === 'HDGSNN_POINTS_TO_HOURS') {
    const score = hdgsnnScore != null ? Number(hdgsnnScore) : 0
    const perPoint = 600
    if (score <= 0) warnings.push('Thiếu điểm HĐGSNN hợp lệ')
    return { B0: score * perPoint, warnings }
  }

  if (k === 'MULTIPLY_C') {
    if (hv <= 0) warnings.push('MULTIPLY_C: hours_value không hợp lệ')
    // Công bố: không có xếp loại nghiệm thu — dùng c = 1
    return { B0: hv, warnings }
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

/**
 * Điểm quy đổi gốc (P0) theo cùng loại rule — ưu `points_value` trong danh mục, thiếu thì dùng `hours_value` làm điểm mặc định.
 * HĐGSNN: điểm = điểm nhập trên bài (đúng nghĩa điểm).
 */
function basePointsFromRule(
  kind: string,
  rule: ResearchOutputRule,
  _authors: Array<{ affiliationType: string }>,
  hdgsnnScore: number | null,
  _aQuyDinh: number
): { P0: number; warnings: string[] } {
  const warnings: string[] = []
  const k = kind.toUpperCase()
  const pv = rule.pointsValue != null ? Number(rule.pointsValue) : 0
  const hv = rule.hoursValue != null ? Number(rule.hoursValue) : 0

  if (k === 'HDGSNN_POINTS_TO_HOURS') {
    const score = hdgsnnScore != null ? Number(hdgsnnScore) : 0
    if (score <= 0) warnings.push('Thiếu điểm HĐGSNN hợp lệ')
    return { P0: score, warnings }
  }

  if (k === 'MULTIPLY_A') {
    const base = pv > 0 ? pv : hv
    if (base <= 0) warnings.push('MULTIPLY_A: thiếu điểm quy đổi (points_value hoặc hours_value)')
    // Theo phụ lục 1883: điểm quy đổi lấy theo cột điểm của loại kết quả, không nhân a.
    return { P0: base, warnings }
  }

  if (k === 'FIXED' || k === 'MULTIPLY_C') {
    const base = pv > 0 ? pv : hv
    return { P0: base, warnings }
  }

  if (k === 'BONUS_ADD') {
    const bonus = rule.hoursBonus != null ? Number(rule.hoursBonus) : 0
    const base = pv > 0 ? pv : hv
    return { P0: base + bonus, warnings }
  }

  if (k === 'RANGE_REVENUE') {
    return { P0: 0, warnings }
  }

  warnings.push(`Rule kind ${k}: chưa suy điểm quy đổi`)
  return { P0: 0, warnings }
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
  const tacGiaTrongNhomChinh = authors.filter((a) => a.isMainAuthor || a.isCorresponding)
  let n = tacGiaTrongNhomChinh.length
  /** p luôn là tổng số tác giả của công trình (không phải chỉ số tác giả liên hệ). */
  const p = tongTacGia
  const coTacGiaLienHe = authors.some((a) => a.isCorresponding)
  if (!coTacGiaLienHe) {
    warnings.push(
      'Chưa đánh dấu tác giả liên hệ: hệ số a mục 1.1 tính trên toàn bộ tác giả (như mục 3); nên đánh dấu đúng tác giả liên hệ để áp đúng mục 1–2.'
    )
  }

  // Không có tác giả chính (n=0) → công thức QĐ không chạy; thường do quên tick trên UI hoặc dữ liệu cũ.
  if (n < 1) {
    if (tongTacGia === 1) {
      n = 1
      warnings.push(
        'Chỉ có một tác giả nhưng chưa đánh dấu tác giả chính — tạm dùng n=1 để tính giờ quy đổi.'
      )
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

  const aQd = heSoAQdCongBoMuc12(authors)

  let rule: ResearchOutputRule
  try {
    rule = await ResearchOutputRule.query().where('type_id', typeId).firstOrFail()
  } catch {
    warnings.push(`Không tìm thấy rule cho type_id=${typeId}`)
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, typeId } }
  }

  const kind = (rule.ruleKind || '').toUpperCase()
  const { B0: rawB0, warnings: w2 } = baseHoursFromRule(
    kind,
    rule,
    authors,
    publication.hdgsnnScore ?? null,
    aQd
  )
  const { P0: rawP0, warnings: w2p } = basePointsFromRule(
    kind,
    rule,
    authors,
    publication.hdgsnnScore ?? null,
    aQd
  )
  warnings.push(...w2)
  warnings.push(...w2p)
  // Chỉ dừng khi cả giờ gốc và điểm gốc đều không hợp lệ (tránh mất điểm khi rule chỉ khai báo một trong hai).
  if (rawB0 <= 0 && rawP0 <= 0) {
    warnings.push('Rule không cho giờ hoặc điểm cơ sở hợp lệ (B0 và P0 đều ≤ 0).')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, typeId, ruleKind: kind } }
  }

  const authorForProfile = chonTacGiaChoProfile(publication, authors, context, warnings)
  if (!authorForProfile) {
    warnings.push('Giảng viên không nằm trong danh sách tác giả của bài báo (không khớp profile_id / họ tên)')
    return { hours: 0, points: 0, warnings, details: { publicationId: publication.id, profileId: context.profileId } }
  }

  const aExcel = aQd
  /** Bảng QĐ: B = B0 × a (không nhân thêm hệ số theo dòng cơ quan; a đã phản ánh mục 1.1). */
  const aFactor = 1
  /**
   * MULTIPLY_A / HĐGSNN: B0 (hoặc P0) đã nhân a trong base*FromRule — không nhân a lần hai.
   * FIXED / MULTIPLY_C / …: B0 là giờ cột bảng (VD 1800), nhân a để được B.
   */
  const daNhanATrongB0 = kind === 'MULTIPLY_A' || kind === 'HDGSNN_POINTS_TO_HOURS'
  const heSoATrongCongThucB = daNhanATrongB0 ? 1 : aExcel
  const B = (rawB0 > 0 ? rawB0 : 0) * heSoATrongCongThucB
  // Điểm quy đổi theo phụ lục: lấy theo cột điểm (hoặc điểm HĐGSNN), không chia n/p và không nhân a.
  const P = rawP0 > 0 ? rawP0 : 0

  if (authorForProfile.affiliationType === 'OUTSIDE') {
    warnings.push(
      'Tác giả chỉ ghi đơn vị ngoài ĐHĐN nên không được tính giờ/điểm quy đổi theo mục 1.5.'
    )
    return {
      hours: 0,
      points: 0,
      warnings,
      details: {
        publicationId: publication.id,
        typeId,
        B0: rawB0,
        P0: rawP0,
        aExcel,
        aFactor,
        B,
        P,
        n,
        p,
        tongTacGia,
        isMainAuthor: false,
        multiAffiliationDivide: false,
        femaleBonus: context.isFemale ?? false,
        ruleKind: kind,
        matchedFullName: authorForProfile.fullName,
      },
    }
  }

  /** Thuộc nhóm nhận 1/3 chia đều + phần 2/3 chia p: tác giả đầu (chính) hoặc tác giả liên hệ. */
  const trongNhomChinhTheoQD =
    authorForProfile.isMainAuthor || authorForProfile.isCorresponding
  const isMain = trongNhomChinhTheoQD || tongTacGia === 1
  let hours = isMain ? B / (3 * n) + (2 * B) / (3 * p) : (2 * B) / (3 * p)
  let points = P

  if (authorForProfile.isMultiAffiliationOutsideUdn) {
    hours /= 2
  }
  if (context.isFemale) {
    hours *= 1.2
  }

  hours = Math.round(hours * 100) / 100
  points = Math.round(points * 100) / 100

  return {
    hours,
    points,
    warnings,
    details: {
      publicationId: publication.id,
      typeId,
      B0: rawB0,
      P0: rawP0,
      /** Hệ số a theo QĐ (cả tập tác giả): cùng ĐHĐN = 2, … */
      aExcel,
      /** Luôn 1: sau B = B0×a không nhân thêm theo dòng (theo bảng QĐ chỉ có ×a). */
      aFactor,
      B,
      P,
      n,
      p,
      tongTacGia,
      isMainAuthor: isMain,
      multiAffiliationDivide: authorForProfile.isMultiAffiliationOutsideUdn,
      femaleBonus: context.isFemale ?? false,
      ruleKind: kind,
      /** Dòng tác giả dùng để tính phần NCV (hiển thị preview theo từng tên) */
      matchedFullName: authorForProfile.fullName,
    },
  }
}
