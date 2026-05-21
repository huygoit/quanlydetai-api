/**
 * Danh mục cơ quan công tác (trường thành viên ĐHĐN) — dùng key ổn định, không FK departments.
 */
export type UdnAffiliationUnitKey =
  | 'UDN'
  | 'UDN_UST'
  | 'UDN_UE'
  | 'UDN_USE'
  | 'UDN_UFLS'
  | 'UDN_UTE'
  | 'UDN_VKU'
  | 'UDN_MED'
  | 'UDN_KON_TUM'
  | 'UDN_VUK'
  | 'UDN_DNIIT'
  | 'UDN_PE'
  | 'UDN_DEFENSE_CENTER'
  | 'OTHER'

export type UdnAffiliationUnit = {
  key: UdnAffiliationUnitKey
  value: string
}

/** Nhãn đơn vị khác (ngoài ĐHĐN) */
export const OTHER_ORG_LABEL = 'Other Organization (Đơn vị khác)'

export const UDN_AFFILIATION_UNITS: readonly UdnAffiliationUnit[] = [
  {
    key: 'UDN',
    value: 'The University of Danang (Đại học Đà Nẵng)',
  },
  {
    key: 'UDN_UST',
    value:
      'The University of Danang - University of Science and Technology (Trường Đại học Bách khoa)',
  },
  {
    key: 'UDN_UE',
    value: 'The University of Danang - University of Economics (Trường Đại học Kinh tế)',
  },
  {
    key: 'UDN_USE',
    value:
      'The University of Danang - University of Science and Education (Trường Đại học Sư phạm)',
  },
  {
    key: 'UDN_UFLS',
    value:
      'University of Foreign Language Studies - The University of Danang (Trường Đại học Ngoại ngữ)',
  },
  {
    key: 'UDN_UTE',
    value:
      'University of Technology and Education - The University of Danang (Trường Đại học Sư phạm Kỹ thuật)',
  },
  {
    key: 'UDN_VKU',
    value:
      'Vietnam-Korea University of Information and Communication Technology - The University of Danang (Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn)',
  },
  {
    key: 'UDN_MED',
    value: 'School of Medicine and Pharmacy - The University of Danang (Trường Y Dược)',
  },
  {
    key: 'UDN_KON_TUM',
    value: 'The University of Danang Campus in Kon Tum (Phân hiệu Đại học Đà Nẵng tại Kon Tum)',
  },
  {
    key: 'UDN_VUK',
    value:
      'Vietnam-UK Institute for Research and Executive Education - The University of Danang (Viện Nghiên cứu và Đào tạo Việt - Anh)',
  },
  {
    key: 'UDN_DNIIT',
    value:
      'Danang International Institute of Technology - The University of Danang (Viện Công nghệ Quốc tế DNIIT)',
  },
  {
    key: 'UDN_PE',
    value: 'Faculty of Physical Education - The University of Danang (Khoa Giáo dục Thể chất)',
  },
  {
    key: 'UDN_DEFENSE_CENTER',
    value:
      'Center for Defense and Security Education - The University of Danang (Trung tâm Giáo dục Quốc phòng và An ninh)',
  },
  {
    key: 'OTHER',
    value: OTHER_ORG_LABEL,
  },
] as const

export const UDN_AFFILIATION_UNIT_KEYS = UDN_AFFILIATION_UNITS.map((u) => u.key)

const unitByKey = new Map<UdnAffiliationUnitKey, UdnAffiliationUnit>(
  UDN_AFFILIATION_UNITS.map((u) => [u.key, u])
)

const unitByValueNorm = new Map<string, UdnAffiliationUnit>()

for (const unit of UDN_AFFILIATION_UNITS) {
  unitByValueNorm.set(normalizeMatchText(unit.value), unit)
  const vnPart = extractVietnameseLabel(unit.value)
  if (vnPart) {
    unitByValueNorm.set(normalizeMatchText(vnPart), unit)
  }
}

/** Chuẩn hóa chuỗi để so khớp một phần (bỏ dấu, gộp khoảng trắng). */
export function normalizeMatchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

/** Lấy phần tiếng Việt trong ngoặc, ví dụ "(Trường Đại học Sư phạm)". */
export function extractVietnameseLabel(value: string): string | null {
  const m = value.match(/\(([^)]+)\)\s*$/)
  return m?.[1]?.trim() ?? null
}

export function isUdnAffiliationUnitKey(key: string): key is UdnAffiliationUnitKey {
  return unitByKey.has(key as UdnAffiliationUnitKey)
}

export function getUdnAffiliationUnit(key: UdnAffiliationUnitKey): UdnAffiliationUnit {
  return unitByKey.get(key)!
}

export function getUdnAffiliationUnitLabel(key: UdnAffiliationUnitKey | string | null): string | null {
  if (!key || !isUdnAffiliationUnitKey(key)) return null
  return getUdnAffiliationUnit(key).value
}

/**
 * Tìm key từ nhãn đầy đủ, key, hoặc text tự do (khớp một phần).
 */
export function resolveUdnAffiliationUnitKey(input: string | null | undefined): UdnAffiliationUnitKey | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  if (isUdnAffiliationUnitKey(raw)) return raw

  const norm = normalizeMatchText(raw)
  const exact = unitByValueNorm.get(norm)
  if (exact) return exact.key

  let best: { unit: UdnAffiliationUnit; score: number } | null = null
  for (const unit of UDN_AFFILIATION_UNITS) {
    if (unit.key === 'OTHER') continue
    const candidates = [unit.value, extractVietnameseLabel(unit.value)].filter(Boolean) as string[]
    for (const candidate of candidates) {
      const cNorm = normalizeMatchText(candidate)
      if (!cNorm) continue
      if (norm === cNorm || norm.includes(cNorm) || cNorm.includes(norm)) {
        const score = Math.min(norm.length, cNorm.length)
        if (!best || score > best.score) {
          best = { unit, score }
        }
      }
    }
  }

  if (best) return best.unit.key

  if (
    norm.includes('university of danang') ||
    norm.includes('dai hoc da nang') ||
    norm.includes('dai hoc dang')
  ) {
    return 'UDN'
  }

  return null
}

/** Danh sách cho API / dropdown (không gồm OTHER trừ khi cần). */
export function listUdnAffiliationUnitsForSelect(includeOther = false) {
  return UDN_AFFILIATION_UNITS.filter((u) => includeOther || u.key !== 'OTHER').map((u) => ({
    key: u.key,
    value: u.value,
  }))
}
