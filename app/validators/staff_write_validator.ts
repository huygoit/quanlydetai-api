import vine from '@vinejs/vine'

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const

const optionalStaffFields = {
  gender: vine.enum(GENDERS).optional().nullable(),
  dateOfBirth: vine.string().trim().optional().nullable(),
  placeOfBirth: vine.string().trim().maxLength(255).optional().nullable(),
  phone: vine.string().trim().maxLength(50).optional().nullable(),
  email: vine.string().email().trim().optional().nullable(),
  currentAddress: vine.string().trim().optional().nullable(),
  departmentId: vine.number().positive().optional().nullable(),
  positionTitle: vine.string().trim().maxLength(255).optional().nullable(),
  staffType: vine.string().trim().maxLength(100).optional().nullable(),
  currentJob: vine.string().trim().maxLength(255).optional().nullable(),
  professionalDegree: vine.string().trim().maxLength(100).optional().nullable(),
  academicTitle: vine.string().trim().maxLength(100).optional().nullable(),
  major: vine.string().trim().maxLength(255).optional().nullable(),
  identityNumber: vine.string().trim().maxLength(50).optional().nullable(),
  identityIssueDate: vine.string().trim().optional().nullable(),
  identityIssuePlace: vine.string().trim().maxLength(255).optional().nullable(),
  userId: vine.number().positive().optional().nullable(),
  note: vine.string().trim().optional().nullable(),
}

export const createStaffValidator = vine.compile(
  vine.object({
    staffCode: vine.string().trim().minLength(1).maxLength(100),
    fullName: vine.string().trim().minLength(1).maxLength(255),
    ...optionalStaffFields,
  })
)

export const updateStaffValidator = vine.compile(
  vine.object({
    staffCode: vine.string().trim().minLength(1).maxLength(100).optional(),
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    ...optionalStaffFields,
  })
)

/** Cán bộ tự sửa — không đổi mã NV / userId / note */
export const updateOwnStaffValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    gender: vine.enum(GENDERS).optional().nullable(),
    dateOfBirth: vine.string().trim().optional().nullable(),
    placeOfBirth: vine.string().trim().maxLength(255).optional().nullable(),
    phone: vine.string().trim().maxLength(50).optional().nullable(),
    email: vine.string().email().trim().optional().nullable(),
    currentAddress: vine.string().trim().optional().nullable(),
    departmentId: vine.number().positive().optional().nullable(),
    positionTitle: vine.string().trim().maxLength(255).optional().nullable(),
    staffType: vine.string().trim().maxLength(100).optional().nullable(),
    professionalDegree: vine.string().trim().maxLength(100).optional().nullable(),
    academicTitle: vine.string().trim().maxLength(100).optional().nullable(),
    major: vine.string().trim().maxLength(255).optional().nullable(),
    identityNumber: vine.string().trim().maxLength(50).optional().nullable(),
    identityIssueDate: vine.string().trim().optional().nullable(),
    identityIssuePlace: vine.string().trim().maxLength(255).optional().nullable(),
  })
)
