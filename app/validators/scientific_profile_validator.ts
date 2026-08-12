import vine from '@vinejs/vine'
import { UDN_AFFILIATION_UNIT_KEYS } from '#constants/udn_affiliation_units'
import {
  SCIENTIFIC_PROFILE_ACADEMIC_TITLE_KEYS,
  SCIENTIFIC_PROFILE_DEGREE_KEYS,
} from '#constants/scientific_profile_catalog'

/** Key cơ quan công tác (không dùng OTHER cho hồ sơ). */
const PROFILE_ORGANIZATION_KEYS = UDN_AFFILIATION_UNIT_KEYS.filter((k) => k !== 'OTHER')

/**
 * Tạo hồ sơ (POST /api/profile/me) - bắt buộc fullName, workEmail; organization hoặc organizationId.
 */
export const createProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255),
    workEmail: vine.string().trim().email().maxLength(255),
    organization: vine.string().trim().maxLength(255).optional(),
    organizationId: vine.enum(PROFILE_ORGANIZATION_KEYS).optional(),
    organization_id: vine.enum(PROFILE_ORGANIZATION_KEYS).optional(),
    departmentId: vine.number().optional(),
    department_id: vine.number().optional(),
    faculty: vine.string().trim().maxLength(255).optional(),
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
    organizationId: vine.enum(PROFILE_ORGANIZATION_KEYS).optional(),
    organization_id: vine.enum(PROFILE_ORGANIZATION_KEYS).optional(),
    faculty: vine.string().trim().maxLength(255).optional(),
    departmentId: vine.number().optional(),
    department_id: vine.number().optional(),
    department: vine.string().trim().maxLength(255).optional(),
    currentTitle: vine.string().trim().maxLength(100).optional(),
    managementRole: vine.string().trim().maxLength(100).optional(),
    startWorkingAt: vine.string().trim().optional(),
    degree: vine.enum(SCIENTIFIC_PROFILE_DEGREE_KEYS).optional(),
    academicTitle: vine.enum(SCIENTIFIC_PROFILE_ACADEMIC_TITLE_KEYS).optional(),
    academicTitleYear: vine.number().min(1900).max(new Date().getFullYear() + 1).optional(),
    academic_title_year: vine.number().min(1900).max(new Date().getFullYear() + 1).optional(),
    degreeYear: vine.number().optional(),
    degreeInstitution: vine.string().trim().maxLength(255).optional(),
    degreeCountry: vine.string().trim().maxLength(100).optional(),
    mainResearchArea: vine.string().trim().maxLength(255).optional(),
    researchFieldId: vine.number().withoutDecimals().positive().nullable().optional(),
    specialization: vine.string().trim().maxLength(255).nullable().optional(),
    specializationId: vine.number().withoutDecimals().positive().nullable().optional(),
    subResearchAreas: vine.array(vine.string()).optional(),
    keywords: vine.array(vine.string()).optional(),

    /** Quá trình đào tạo theo bậc (Đại học / Thạc sĩ / NCS / …) */
    educationRecords: vine
      .array(
        vine.object({
          id: vine.string().trim().maxLength(64).optional(),
          level: vine
            .enum([
              'UNDERGRADUATE',
              'BACHELOR',
              'MASTER',
              'PHD_CANDIDATE',
              'DOCTORATE',
              'OTHER',
            ] as const)
            .optional(),
          major: vine.string().trim().maxLength(255).optional(),
          institution: vine.string().trim().maxLength(255).optional(),
          country: vine.string().trim().maxLength(100).optional(),
          startYear: vine.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
          endYear: vine.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
          trainingForm: vine.string().trim().maxLength(100).optional(),
          note: vine.string().trim().maxLength(500).optional(),
        })
      )
      .optional(),
    education_records: vine.array(vine.any()).optional(),

    /** Khóa tập huấn / bồi dưỡng chuyên môn */
    trainingCourses: vine
      .array(
        vine.object({
          id: vine.string().trim().maxLength(64).optional(),
          name: vine.string().trim().maxLength(255).optional(),
          organizer: vine.string().trim().maxLength(255).optional(),
          location: vine.string().trim().maxLength(255).optional(),
          startYear: vine.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
          endYear: vine.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
          certificate: vine.string().trim().maxLength(255).optional(),
          note: vine.string().trim().maxLength(500).optional(),
        })
      )
      .optional(),
    training_courses: vine.array(vine.any()).optional(),

    /**
     * Cho phép FE lưu nested languages trong PUT /profile/me.
     * Nếu gửi mảng này thì backend sẽ replace toàn bộ languages theo payload.
     */
    languages: vine
      .array(
        vine.object({
          language: vine.string().trim().minLength(1).maxLength(50),
          level: vine.string().trim().maxLength(20).optional(),
          certificate: vine.string().trim().maxLength(100).optional(),
          /**
           * Link chứng chỉ: không dùng rule `.url()` của Vine vì `validator.isURL` quá chặt
           * (presigned URL dài, ký tự đặc biệt, host nội bộ…) dễ làm fail oan.
           * Backend vẫn chuẩn hoá/ghi DB an toàn qua `normalizeOptionalHttpUrl` trước khi lưu.
           */
          certificateUrl: vine.string().trim().maxLength(2000).optional(),
          certificate_url: vine.string().trim().maxLength(2000).optional(),
        })
      )
      .optional(),
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
