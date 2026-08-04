/**
 * Ghép học hàm + học vị + họ tên để hiển thị thành viên đề tài.
 * Không có học hàm/học vị → chỉ trả tên.
 */
const HOC_HAM_LABEL: Record<string, string> = {
  ASSOCIATE_PROFESSOR: 'PGS',
  PROFESSOR: 'GS',
  PGS: 'PGS',
  GS: 'GS',
}

const HOC_VI_LABEL: Record<string, string> = {
  DOCTORATE: 'Tiến sĩ',
  MASTER: 'Thạc sĩ',
  BACHELOR: 'Cử nhân',
  ENGINEER: 'Kỹ sư',
  TS: 'Tiến sĩ',
  ThS: 'Thạc sĩ',
  CN: 'Cử nhân',
  KS: 'Kỹ sư',
  'Tiến sĩ': 'Tiến sĩ',
  'Thạc sĩ': 'Thạc sĩ',
  'Cử nhân': 'Cử nhân',
  'Kỹ sư': 'Kỹ sư',
}

function nhanHocHam(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const s = String(raw).trim()
  if (!s || s.toUpperCase() === 'NONE' || s === 'Không') return undefined
  return HOC_HAM_LABEL[s] || HOC_HAM_LABEL[s.toUpperCase()] || (/^(GS|PGS)$/i.test(s) ? s.toUpperCase() : undefined)
}

function nhanHocVi(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const s = String(raw).trim()
  if (!s) return undefined
  return HOC_VI_LABEL[s] || HOC_VI_LABEL[s.toUpperCase()] || undefined
}

export function formatMemberDisplayFullName(opts: {
  fullName?: string | null
  degree?: string | null
  academicTitle?: string | null
}): string {
  const ten = String(opts.fullName ?? '').trim()
  const parts: string[] = []
  const ham = nhanHocHam(opts.academicTitle)
  const vi = nhanHocVi(opts.degree)
  if (ham) parts.push(ham)
  if (vi) parts.push(vi)
  if (ten) parts.push(ten)
  return parts.join('. ')
}
