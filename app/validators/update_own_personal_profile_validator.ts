import vine from '@vinejs/vine'

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const

/**
 * Cán bộ tự cập nhật hồ sơ — không đổi trạng thái / ghi chú nội bộ.
 */
export const updateOwnPersonalProfileValidator = vine.compile(
  vine.object({
    staffCode: vine.string().trim().maxLength(50).optional(),
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    gender: vine.enum(GENDERS).optional(),
    dateOfBirth: vine.string().optional(),
    placeOfBirth: vine.string().trim().maxLength(255).optional(),
    phone: vine.string().trim().maxLength(50).optional(),
    personalEmail: vine.string().email().trim().optional(),
    workEmail: vine.string().email().trim().optional(),
    address: vine.string().trim().optional(),
    departmentId: vine.number().optional(),
    positionTitle: vine.string().trim().maxLength(255).optional(),
    employmentType: vine.string().trim().maxLength(50).optional(),
    academicDegree: vine.string().trim().maxLength(100).optional(),
    academicTitle: vine.string().trim().maxLength(100).optional(),
    specialization: vine.string().trim().maxLength(255).optional(),
    professionalQualification: vine.string().trim().maxLength(255).optional(),
    identityNumber: vine.string().trim().maxLength(50).optional(),
    identityIssueDate: vine.string().optional(),
    identityIssuePlace: vine.string().trim().maxLength(255).optional(),
  })
)
