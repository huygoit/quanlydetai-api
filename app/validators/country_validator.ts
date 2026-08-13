import vine from '@vinejs/vine'
import { COUNTRY_STATUSES } from '#types/country'

export const createCountryValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(10),
    name: vine.string().trim().minLength(1).maxLength(255),
    displayOrder: vine.number().optional(),
    status: vine.enum(COUNTRY_STATUSES).optional(),
  })
)

export const updateCountryValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(10).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(COUNTRY_STATUSES).optional(),
  })
)

export const updateCountryStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(COUNTRY_STATUSES),
  })
)
