/**
 * Danh mục học vị / học hàm hồ sơ khoa học — nguồn dùng chung API catalog + validator.
 * Học vị: `value` = key tiếng Anh; `label` = nhãn tiếng Việt hiển thị.
 */

export type ScientificProfileDegreeKey =
  | 'HIGH_SCHOOL'
  | 'BACHELOR'
  | 'UNDERGRADUATE'
  | 'MASTER'
  | 'DOCTORATE'

export type ScientificProfileAcademicTitleKey = 'NONE' | 'ASSOCIATE_PROFESSOR' | 'PROFESSOR'

export type ScientificProfileAcademicTitleItem = {
  key: ScientificProfileAcademicTitleKey
  label: string
  displayOrder: number
}

export type ScientificProfileDegreeItem = {
  key: ScientificProfileDegreeKey
  label: string
  description: string
  displayOrder: number
}

export type ScientificProfileCatalogOption = {
  value: string
  label: string
  description?: string
  displayOrder: number
}

export const SCIENTIFIC_PROFILE_DEGREES: readonly ScientificProfileDegreeItem[] = [
  {
    key: 'HIGH_SCHOOL',
    label: 'Tú tài',
    description: 'Tốt nghiệp Trung học Phổ thông.',
    displayOrder: 1,
  },
  {
    key: 'BACHELOR',
    label: 'Cử nhân',
    description:
      'Tốt nghiệp đại học các khối ngành kinh tế, luật, xã hội và các ngành tương đương.',
    displayOrder: 2,
  },
  {
    key: 'UNDERGRADUATE',
    label: 'Đại học',
    description: 'Tốt nghiệp trình độ đại học (bằng đại học).',
    displayOrder: 3,
  },
  {
    key: 'MASTER',
    label: 'Thạc sĩ',
    description: 'Tốt nghiệp trình độ cao học.',
    displayOrder: 4,
  },
  {
    key: 'DOCTORATE',
    label: 'Tiến sĩ',
    description:
      'Trình độ học vị nghiên cứu chuyên sâu, được cấp sau khi bảo vệ thành công luận án tiến sĩ.',
    displayOrder: 5,
  },
] as const

export const SCIENTIFIC_PROFILE_DEGREE_KEYS = SCIENTIFIC_PROFILE_DEGREES.map((d) => d.key)

export const SCIENTIFIC_PROFILE_ACADEMIC_TITLES: readonly ScientificProfileAcademicTitleItem[] = [
  { key: 'NONE', label: 'Không', displayOrder: 1 },
  { key: 'ASSOCIATE_PROFESSOR', label: 'PGS', displayOrder: 2 },
  { key: 'PROFESSOR', label: 'GS', displayOrder: 3 },
] as const

export const SCIENTIFIC_PROFILE_ACADEMIC_TITLE_KEYS = SCIENTIFIC_PROFILE_ACADEMIC_TITLES.map(
  (t) => t.key
)

const degreeByKey = new Map<ScientificProfileDegreeKey, ScientificProfileDegreeItem>(
  SCIENTIFIC_PROFILE_DEGREES.map((d) => [d.key, d])
)

const degreeByLabelNorm = new Map<string, ScientificProfileDegreeKey>()
for (const d of SCIENTIFIC_PROFILE_DEGREES) {
  degreeByLabelNorm.set(normalizeDegreeMatchText(d.label), d.key)
  degreeByLabelNorm.set(normalizeDegreeMatchText(d.key), d.key)
}

/** Nhãn tiếng Việt / key cũ → key tiếng Anh hiện tại */
const LEGACY_DEGREE_TO_KEY: Record<string, ScientificProfileDegreeKey> = {
  'tú tài': 'HIGH_SCHOOL',
  'tu tai': 'HIGH_SCHOOL',
  tu_tai: 'HIGH_SCHOOL',
  'cử nhân': 'BACHELOR',
  'cu nhan': 'BACHELOR',
  cu_nhan: 'BACHELOR',
  'đại học': 'UNDERGRADUATE',
  'dai hoc': 'UNDERGRADUATE',
  dai_hoc: 'UNDERGRADUATE',
  'thạc sĩ': 'MASTER',
  'thac si': 'MASTER',
  thac_si: 'MASTER',
  'tiến sĩ': 'DOCTORATE',
  'tien si': 'DOCTORATE',
  tien_si: 'DOCTORATE',
  khác: 'BACHELOR',
  khac: 'BACHELOR',
}

function normalizeDegreeMatchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

const academicTitleByKey = new Map<
  ScientificProfileAcademicTitleKey,
  ScientificProfileAcademicTitleItem
>(SCIENTIFIC_PROFILE_ACADEMIC_TITLES.map((t) => [t.key, t]))

const academicTitleByLabelNorm = new Map<string, ScientificProfileAcademicTitleKey>()
for (const t of SCIENTIFIC_PROFILE_ACADEMIC_TITLES) {
  academicTitleByLabelNorm.set(normalizeDegreeMatchText(t.label), t.key)
  academicTitleByLabelNorm.set(normalizeDegreeMatchText(t.key), t.key)
}

const LEGACY_ACADEMIC_TITLE_TO_KEY: Record<string, ScientificProfileAcademicTitleKey> = {
  khong: 'NONE',
  'không': 'NONE',
  none: 'NONE',
  pgs: 'ASSOCIATE_PROFESSOR',
  'pho giao su': 'ASSOCIATE_PROFESSOR',
  'phó giáo sư': 'ASSOCIATE_PROFESSOR',
  associate_professor: 'ASSOCIATE_PROFESSOR',
  gs: 'PROFESSOR',
  'giao su': 'PROFESSOR',
  'giáo sư': 'PROFESSOR',
  professor: 'PROFESSOR',
}

export function listScientificProfileDegreeOptions(): ScientificProfileCatalogOption[] {
  return SCIENTIFIC_PROFILE_DEGREES.map((d) => ({
    value: d.key,
    label: d.label,
    description: d.description,
    displayOrder: d.displayOrder,
  })).sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value))
}

export function listScientificProfileAcademicTitleOptions(): ScientificProfileCatalogOption[] {
  return SCIENTIFIC_PROFILE_ACADEMIC_TITLES.map((t) => ({
    value: t.key,
    label: t.label,
    displayOrder: t.displayOrder,
  })).sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value))
}

export function isScientificProfileDegreeKey(value: string): value is ScientificProfileDegreeKey {
  return degreeByKey.has(value as ScientificProfileDegreeKey)
}

export function getScientificProfileDegreeLabel(
  key: ScientificProfileDegreeKey | string | null | undefined
): string | null {
  if (!key || !isScientificProfileDegreeKey(key)) return null
  return degreeByKey.get(key)!.label
}

export function resolveScientificProfileDegreeKey(
  input: string | null | undefined
): ScientificProfileDegreeKey | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  if (isScientificProfileDegreeKey(raw)) return raw

  const norm = normalizeDegreeMatchText(raw)
  const fromLabel = degreeByLabelNorm.get(norm)
  if (fromLabel) return fromLabel

  const legacy = LEGACY_DEGREE_TO_KEY[norm]
  if (legacy) return legacy

  return null
}

export function isScientificProfileAcademicTitleKey(
  value: string
): value is ScientificProfileAcademicTitleKey {
  return academicTitleByKey.has(value as ScientificProfileAcademicTitleKey)
}

export function getScientificProfileAcademicTitleLabel(
  key: ScientificProfileAcademicTitleKey | string | null | undefined
): string | null {
  if (!key || !isScientificProfileAcademicTitleKey(key)) return null
  return academicTitleByKey.get(key)!.label
}

/** Chuỗi thường là học vị — không map sang học hàm. */
function looksLikeDegreeNotTitle(norm: string): boolean {
  return (
    norm.includes('dai hoc') ||
    norm.includes('thac si') ||
    norm.includes('thac sy') ||
    norm.includes('tien si') ||
    norm.includes('tien sy') ||
    norm.includes('cu nhan') ||
    norm.includes('tu tai')
  )
}

export function resolveScientificProfileAcademicTitleKey(
  input: string | null | undefined
): ScientificProfileAcademicTitleKey | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  if (isScientificProfileAcademicTitleKey(raw)) return raw

  const norm = normalizeDegreeMatchText(raw)
  if (looksLikeDegreeNotTitle(norm)) return null

  const fromLabel = academicTitleByLabelNorm.get(norm)
  if (fromLabel) return fromLabel

  const legacy = LEGACY_ACADEMIC_TITLE_TO_KEY[norm]
  if (legacy) return legacy

  if (norm.includes('pho giao') || norm.startsWith('pgs')) return 'ASSOCIATE_PROFESSOR'
  if ((norm.includes('giao su') || norm === 'gs') && !norm.includes('pho')) return 'PROFESSOR'

  return null
}
