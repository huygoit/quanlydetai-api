import vine from '@vinejs/vine'
import { errors } from '@vinejs/vine'

const AFFILIATION_TYPES = ['UDN_ONLY', 'MIXED', 'OUTSIDE'] as const
const AUTHOR_GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const

/** Tác giả không liên kết profile_id / student_id — cần gender nhập tay. */
export function laTacGiaNhapTay(row: {
  profile_id?: number | null
  profileId?: number | null
  student_id?: number | null
  studentId?: number | null
}): boolean {
  const pid = row.profile_id !== undefined ? row.profile_id : row.profileId
  const sid = row.student_id !== undefined ? row.student_id : row.studentId
  return (pid == null || pid === undefined) && (sid == null || sid === undefined)
}

/** Ép id (Lucid/JSON có thể là string/bigint) về number an toàn */
function toFiniteId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'bigint') return Number(v)
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Hai profile id có cùng giá trị số (tránh 8 !== "8") */
function profileIdsEqual(a: unknown, b: unknown): boolean {
  const na = toFiniteId(a)
  const nb = toFiniteId(b)
  return na !== null && nb !== null && na === nb
}

/** Chuẩn hoá họ tên để so khớp với dòng tác giả khi client không gửi profile_id */
function chuanHoaHoTen(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Schema một tác giả trong danh sách PUT /publications/:id/authors (chấp nhận snake_case theo spec) */
const authorSchema = vine.object({
  id: vine.number().optional(),
  profile_id: vine.number().optional().nullable(),
  /** FE thường gửi camelCase — chuẩn hoá sang profile_id trước khi lưu */
  profileId: vine.number().optional().nullable(),
  student_id: vine.number().optional().nullable(),
  studentId: vine.number().optional().nullable(),
  gender: vine.enum(AUTHOR_GENDERS).optional().nullable(),
  full_name: vine.string().trim().minLength(1).maxLength(255),
  affiliation_units: vine.array(vine.string().trim().minLength(1).maxLength(255)).optional(),
  author_order: vine.number().min(1),
  is_top_author: vine.boolean(),
  is_corresponding: vine.boolean(),
  affiliation_type: vine.enum(AFFILIATION_TYPES),
  is_multi_affiliation_outside_udn: vine.boolean(),
})

/**
 * Kiểm tra p >= 1, author_order unique; n <= p nếu có nhóm chính.
 * Không bắt buộc nhóm chính (is_top_author / is_corresponding) — FE/KPI xử lý cảnh báo sau.
 */
export function validateAuthorsListRules(
  authors: Array<{ author_order: number; is_top_author: boolean; is_corresponding?: boolean }>
): void {
  const p = authors.length
  if (p < 1) {
    throw new errors.E_VALIDATION_ERROR([
      { field: 'authors', message: 'Cần ít nhất 1 tác giả', rule: 'minLength' },
    ])
  }
  const n = authors.filter((a) => a.is_top_author || a.is_corresponding).length
  if (n > p) {
    throw new errors.E_VALIDATION_ERROR([
      {
        field: 'authors',
        message: 'Số tác giả chính (n) không được lớn hơn tổng số tác giả (p)',
        rule: 'custom',
      },
    ])
  }
  const orders = authors.map((a) => a.author_order)
  const uniqueOrders = new Set(orders)
  if (uniqueOrders.size !== orders.length) {
    throw new errors.E_VALIDATION_ERROR([
      { field: 'authors', message: 'author_order phải duy nhất trong danh sách', rule: 'unique' },
    ])
  }
}

/** Một dòng tác giả sau khi validate Vine (snake_case). */
export type AuthorPayloadRow = {
  id?: number
  profile_id?: number | null
  profileId?: number | null
  student_id?: number | null
  studentId?: number | null
  gender?: (typeof AUTHOR_GENDERS)[number] | null
  full_name: string
  affiliation_units?: string[]
  author_order: number
  is_top_author: boolean
  is_corresponding: boolean
  affiliation_type: (typeof AFFILIATION_TYPES)[number]
  is_multi_affiliation_outside_udn: boolean
}

/** Bắt buộc gender khi tác giả nhập tay (không profile_id / student_id). */
export function validateManualAuthorGender(authors: AuthorPayloadRow[]): void {
  for (let i = 0; i < authors.length; i++) {
    const a = authors[i]!
    if (!laTacGiaNhapTay(a)) continue
    if (a.gender && AUTHOR_GENDERS.includes(a.gender)) continue
    throw new errors.E_VALIDATION_ERROR([
      {
        field: `authors.${i}.gender`,
        message: `Tác giả "${a.full_name.trim()}" (nhập tay) cần chọn giới tính (MALE/FEMALE/OTHER)`,
        rule: 'required',
      },
    ])
  }
}

/** Giá trị gender lưu DB: null nếu liên kết hồ sơ/sinh viên. */
export function resolvedGenderForSave(a: AuthorPayloadRow): (typeof AUTHOR_GENDERS)[number] | null {
  if (!laTacGiaNhapTay(a)) return null
  return a.gender ?? null
}

/**
 * Gộp mọi dòng trùng “chủ hồ sơ”: cùng profile_id hoặc họ tên trùng hồ sơ nhưng chưa gắn profile_id.
 */
export function dedupeOwnerAuthorRowsForProfile(
  authors: AuthorPayloadRow[],
  ownerProfileId: number | string | bigint,
  ownerFullName: string
): void {
  const oid = toFiniteId(ownerProfileId)
  if (oid === null) return

  const normalizedOwner = chuanHoaHoTen(ownerFullName)
  const nameMatchOk = normalizedOwner.length >= 2
  const ownerTrimLower = ownerFullName.trim().toLowerCase()

  const isOwnerRow = (a: AuthorPayloadRow) => {
    if (a.profile_id != null && profileIdsEqual(a.profile_id, oid)) return true
    if (a.profile_id != null) return false
    if (nameMatchOk && chuanHoaHoTen(a.full_name) === normalizedOwner) return true
    if (ownerTrimLower.length > 0 && a.full_name.trim().toLowerCase() === ownerTrimLower) return true
    return false
  }

  const indices: number[] = []
  for (let i = 0; i < authors.length; i++) {
    if (isOwnerRow(authors[i]!)) indices.push(i)
  }
  if (indices.length === 0) return

  if (indices.length === 1) {
    const row = authors[indices[0]!]!
    if (row.profile_id == null) row.profile_id = oid
    return
  }

  const scored = indices.map((i) => {
    const a = authors[i]!
    const hasPid = a.profile_id != null && profileIdsEqual(a.profile_id, oid)
    const hasId = a.id != null
    return { i, a, score: (hasPid ? 2 : 0) + (hasId ? 1 : 0), order: a.author_order }
  })
  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score
    return x.order - y.order
  })

  const keeperIdx = scored[0]!.i
  const keeper = authors[keeperIdx]!
  keeper.profile_id = oid
  keeper.is_top_author = indices.some((i) => authors[i]!.is_top_author)
  keeper.is_corresponding = indices.some((i) => authors[i]!.is_corresponding)
  keeper.author_order = Math.min(...indices.map((i) => authors[i]!.author_order))

  const toRemove = indices.filter((i) => i !== keeperIdx).sort((a, b) => b - a)
  for (const i of toRemove) {
    authors.splice(i, 1)
  }
}

/**
 * Gắn profile_id chủ lên các dòng đã có trong payload — không bao giờ push thêm dòng mới
 * (push từng gây nhân bản “Admin” khi so sánh id lệch kiểu string/bigint).
 */
export function ensureOwnerProfileOnAuthorRows(
  authors: AuthorPayloadRow[],
  ownerProfileId: number | string | bigint,
  ownerFullName: string
): void {
  const oid = toFiniteId(ownerProfileId)
  if (oid === null) return

  if (authors.some((a) => a.profile_id != null && profileIdsEqual(a.profile_id, oid))) {
    return
  }

  const normalizedOwner = chuanHoaHoTen(ownerFullName)
  const ownerTrimLower = ownerFullName.trim().toLowerCase()

  for (const a of authors) {
    if (a.profile_id != null) continue
    const nameHit =
      (normalizedOwner.length >= 2 && chuanHoaHoTen(a.full_name) === normalizedOwner) ||
      (ownerTrimLower.length > 0 && a.full_name.trim().toLowerCase() === ownerTrimLower)
    if (nameHit) {
      a.profile_id = oid
      return
    }
  }

  if (authors.length === 1 && authors[0]!.profile_id == null) {
    authors[0]!.profile_id = oid
  }
}

/**
 * Bắt buộc có ít nhất một dòng gắn profile_id = chủ hồ sơ (sau dedupe/ensure).
 */
export function validateOwnerProfileLinked(
  authors: AuthorPayloadRow[],
  ownerProfileId: number | string | bigint
): void {
  const oid = toFiniteId(ownerProfileId)
  if (oid === null) return

  const ok = authors.some((a) => a.profile_id != null && profileIdsEqual(a.profile_id, oid))
  if (!ok) {
    throw new errors.E_VALIDATION_ERROR([
      {
        field: 'authors',
        message:
          'Phải có ít nhất một tác giả gắn profile_id trùng chủ hồ sơ. Dùng “Chọn từ hồ sơ NCV” trên form hoặc đảm bảo dòng của bạn có profile_id.',
        rule: 'required',
      },
    ])
  }
}

/** @deprecated Dùng ensureOwnerProfileOnAuthorRows + validateOwnerProfileLinked — không push dòng mới. */
export function injectOwnerAuthorRowIfMissing(
  authors: AuthorPayloadRow[],
  ownerProfileId: number,
  ownerFullName: string
): void {
  ensureOwnerProfileOnAuthorRows(authors, ownerProfileId, ownerFullName)
}

/**
 * Chuẩn hoá body PUT authors trước validate: profileId → profile_id, ép id số.
 */
export function prepareAuthorsRequestBody(request: {
  input: (key: string, defaultValue?: unknown) => unknown
}): void {
  const raw = request.input('authors')
  if (!Array.isArray(raw)) return

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>

    if (r.profileId !== undefined && r.profile_id === undefined) {
      r.profile_id = r.profileId
    }
    if (r.studentId !== undefined && r.student_id === undefined) {
      r.student_id = r.studentId
    }

    if (r.id != null && typeof r.id !== 'number') {
      const n = Number(r.id)
      if (Number.isFinite(n)) r.id = Math.trunc(n)
    }
    if (r.profile_id != null && typeof r.profile_id !== 'number') {
      const n = Number(r.profile_id)
      if (Number.isFinite(n)) r.profile_id = Math.trunc(n)
    }
    if (r.profileId != null && typeof r.profileId !== 'number') {
      const n = Number(r.profileId)
      if (Number.isFinite(n)) r.profileId = Math.trunc(n)
    }
    if (r.student_id != null && typeof r.student_id !== 'number') {
      const n = Number(r.student_id)
      if (Number.isFinite(n)) r.student_id = Math.trunc(n)
    }
    if (r.studentId != null && typeof r.studentId !== 'number') {
      const n = Number(r.studentId)
      if (Number.isFinite(n)) r.studentId = Math.trunc(n)
    }
  }
}

/** Sau validate: một giá trị profile_id thống nhất (ưu tiên snake_case). */
export function resolvedProfileIdFromRow(a: AuthorPayloadRow): number | null | undefined {
  if (a.profile_id !== undefined) return a.profile_id ?? null
  if (a.profileId !== undefined) return a.profileId ?? null
  return undefined
}

/** Sau validate: một giá trị student_id thống nhất (ưu tiên snake_case). */
export function resolvedStudentIdFromRow(a: AuthorPayloadRow): number | null | undefined {
  if (a.student_id !== undefined) return a.student_id ?? null
  if (a.studentId !== undefined) return a.studentId ?? null
  return undefined
}

export const upsertPublicationAuthorsValidator = vine.compile(
  vine.object({
    authors: vine.array(authorSchema),
  })
)
