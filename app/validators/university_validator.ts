import vine from '@vinejs/vine'
import {
  UNIVERSITY_REGIONS,
  UNIVERSITY_SCHOOL_BLOCKS,
  UNIVERSITY_STATUSES,
} from '#types/university'

export const createUniversityValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(32),
    name: vine.string().trim().minLength(1).maxLength(255),
    // Tạm optional — UI đang ẩn khu vực/khối
    region: vine.enum(UNIVERSITY_REGIONS).optional(),
    schoolBlock: vine.enum(UNIVERSITY_SCHOOL_BLOCKS).optional(),
    countryId: vine.number().withoutDecimals().positive().nullable().optional(),
    isPrivate: vine.boolean().optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(UNIVERSITY_STATUSES).optional(),
  })
)

export const updateUniversityValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(32).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    region: vine.enum(UNIVERSITY_REGIONS).optional(),
    schoolBlock: vine.enum(UNIVERSITY_SCHOOL_BLOCKS).optional(),
    countryId: vine.number().withoutDecimals().positive().nullable().optional(),
    isPrivate: vine.boolean().optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(UNIVERSITY_STATUSES).optional(),
  })
)

export const updateUniversityStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(UNIVERSITY_STATUSES),
  })
)
