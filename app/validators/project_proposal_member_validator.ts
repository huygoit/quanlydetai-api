import vine from '@vinejs/vine'
import { errors } from '@vinejs/vine'
import {
  prepareAuthorsRequestBody,
  resolvedGenderForSave,
  resolvedProfileIdFromRow,
  resolvedStudentIdFromRow,
  validateManualAuthorGender,
  type AuthorPayloadRow,
} from '#validators/publication_author_validator'

const AFFILIATION_TYPES = ['UDN_ONLY', 'MIXED', 'OUTSIDE'] as const
const AUTHOR_GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const

/** Một thành viên trong PUT /project-proposals/:id/members */
const memberSchema = vine.object({
  id: vine.number().optional(),
  profile_id: vine.number().optional().nullable(),
  profileId: vine.number().optional().nullable(),
  student_id: vine.number().optional().nullable(),
  studentId: vine.number().optional().nullable(),
  gender: vine.enum(AUTHOR_GENDERS).optional().nullable(),
  full_name: vine.string().trim().minLength(1).maxLength(255),
  affiliation_units: vine.array(vine.string().trim().minLength(1).maxLength(255)).optional(),
  /** FE tái dùng AuthorsEditor — chấp nhận author_order hoặc member_order */
  member_order: vine.number().min(1).optional(),
  author_order: vine.number().min(1).optional(),
  affiliation_type: vine.enum(AFFILIATION_TYPES),
  is_multi_affiliation_outside_udn: vine.boolean(),
  contribution_percent: vine.number().min(0).max(100).nullable().optional(),
})

export type MemberPayloadRow = {
  id?: number
  profile_id?: number | null
  profileId?: number | null
  student_id?: number | null
  studentId?: number | null
  gender?: (typeof AUTHOR_GENDERS)[number] | null
  full_name: string
  affiliation_units?: string[]
  member_order?: number
  author_order?: number
  affiliation_type: (typeof AFFILIATION_TYPES)[number]
  is_multi_affiliation_outside_udn: boolean
  contribution_percent?: number | null
}

/** Chuẩn hoá thứ tự thành viên từ author_order hoặc member_order */
export function resolvedMemberOrder(row: MemberPayloadRow): number {
  const n = row.member_order ?? row.author_order
  return Number.isFinite(Number(n)) ? Number(n) : 1
}

/** member_order duy nhất; danh sách rỗng được phép. */
export function validateMembersListRules(members: MemberPayloadRow[]): void {
  const orders = members.map((m) => resolvedMemberOrder(m))
  if (new Set(orders).size !== orders.length) {
    throw new errors.E_VALIDATION_ERROR([
      { field: 'members', message: 'member_order phải duy nhất trong danh sách', rule: 'unique' },
    ])
  }
}

/**
 * Chuẩn hoá body PUT members trước validate.
 * Chấp nhận key `members` hoặc `authors` (AuthorsEditor gửi authors).
 */
export function prepareMembersRequestBody(request: {
  input: (key: string, defaultValue?: unknown) => unknown
  updateBody?: (key: string, value: unknown) => void
  all?: () => Record<string, unknown>
}): void {
  const body = typeof request.all === 'function' ? request.all() : null
  let list = request.input('members')
  if (!Array.isArray(list)) {
    list = request.input('authors')
  }
  if (!Array.isArray(list) && body && Array.isArray(body.members)) {
    list = body.members
  }
  if (!Array.isArray(list) && body && Array.isArray(body.authors)) {
    list = body.authors
  }
  if (!Array.isArray(list)) return

  // Mutate từng dòng: camelCase → snake, author_order → member_order
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>

    if (r.profileId !== undefined && r.profile_id === undefined) {
      r.profile_id = r.profileId
    }
    if (r.studentId !== undefined && r.student_id === undefined) {
      r.student_id = r.studentId
    }
    if (r.member_order == null && r.author_order != null) {
      r.member_order = r.author_order
    }
    if (r.fullName !== undefined && r.full_name === undefined) {
      r.full_name = r.fullName
    }
    if (r.affiliationUnits !== undefined && r.affiliation_units === undefined) {
      r.affiliation_units = r.affiliationUnits
    }
    if (r.affiliationType !== undefined && r.affiliation_type === undefined) {
      r.affiliation_type = r.affiliationType
    }
    if (
      r.isMultiAffiliationOutsideUdn !== undefined &&
      r.is_multi_affiliation_outside_udn === undefined
    ) {
      r.is_multi_affiliation_outside_udn = r.isMultiAffiliationOutsideUdn
    }
    if (r.contributionPercent !== undefined && r.contribution_percent === undefined) {
      r.contribution_percent = r.contributionPercent
    }

    if (r.id != null && typeof r.id !== 'number') {
      const n = Number(r.id)
      if (Number.isFinite(n)) r.id = Math.trunc(n)
    }
    if (r.profile_id != null && typeof r.profile_id !== 'number') {
      const n = Number(r.profile_id)
      if (Number.isFinite(n)) r.profile_id = Math.trunc(n)
    }
    if (r.student_id != null && typeof r.student_id !== 'number') {
      const n = Number(r.student_id)
      if (Number.isFinite(n)) r.student_id = Math.trunc(n)
    }
  }

  // Đảm bảo validator đọc được key members
  if (body) {
    body.members = list
  }
  // Tái dùng chuẩn hoá id số của authors nếu còn sót
  prepareAuthorsRequestBody({
    input: (key: string, defaultValue?: unknown) => {
      if (key === 'authors') return list
      return defaultValue
    },
  })
}

export function validateManualMemberGender(members: MemberPayloadRow[]): void {
  // validateManualAuthorGender báo field authors.* — map lại bằng cách cast
  try {
    validateManualAuthorGender(members as AuthorPayloadRow[])
  } catch (e: any) {
    if (e?.messages && Array.isArray(e.messages)) {
      for (const m of e.messages) {
        if (typeof m.field === 'string') {
          m.field = m.field.replace(/^authors/, 'members')
        }
      }
    }
    throw e
  }
}

export { resolvedGenderForSave, resolvedProfileIdFromRow, resolvedStudentIdFromRow }

export const upsertProjectProposalMembersValidator = vine.compile(
  vine.object({
    members: vine.array(memberSchema),
  })
)
