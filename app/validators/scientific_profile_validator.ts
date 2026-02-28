import vine from '@vinejs/vine'

/**
 * Tạo hồ sơ (POST /api/profile/me) - bắt buộc fullName, workEmail, organization.
 */
export const createProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255),
    workEmail: vine.string().trim().email().maxLength(255),
    organization: vine.string().trim().minLength(1).maxLength(255),
  })
)

/**
 * Cập nhật hồ sơ (PUT /api/profile/me) - tất cả optional.
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    dateOfBirth: vine.string().trim().optional(),
    gender: vine.string().trim().maxLength(10).optional(),
    workEmail: vine.string().trim().email().maxLength(255).optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    orcid: vine.string().trim().maxLength(50).optional(),
    googleScholarUrl: vine.string().trim().maxLength(500).optional(),
    scopusId: vine.string().trim().maxLength(50).optional(),
    researchGateUrl: vine.string().trim().maxLength(500).optional(),
    personalWebsite: vine.string().trim().maxLength(500).optional(),
    avatarUrl: vine.string().trim().optional(),
    bio: vine.string().trim().optional(),
    organization: vine.string().trim().maxLength(255).optional(),
    faculty: vine.string().trim().maxLength(255).optional(),
    department: vine.string().trim().maxLength(255).optional(),
    currentTitle: vine.string().trim().maxLength(100).optional(),
    managementRole: vine.string().trim().maxLength(100).optional(),
    startWorkingAt: vine.string().trim().optional(),
    degree: vine.string().trim().maxLength(20).optional(),
    academicTitle: vine.string().trim().maxLength(10).optional(),
    degreeYear: vine.number().optional(),
    degreeInstitution: vine.string().trim().maxLength(255).optional(),
    degreeCountry: vine.string().trim().maxLength(100).optional(),
    mainResearchArea: vine.string().trim().maxLength(255).optional(),
    subResearchAreas: vine.array(vine.string()).optional(),
    keywords: vine.array(vine.string()).optional(),
  })
)

/**
 * Verify / Request more info (note optional).
 */
export const verifyProfileValidator = vine.compile(
  vine.object({
    note: vine.string().trim().optional(),
  })
)
