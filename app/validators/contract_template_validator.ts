import vine from '@vinejs/vine'
import { DOC_TEMPLATE_TYPE_CODES } from '#constants/doc_template_types'

export const createContractTemplateValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(2).maxLength(50),
    name: vine.string().trim().minLength(2).maxLength(255),
    description: vine.string().trim().maxLength(2000).optional().nullable(),
    templateType: vine.enum(DOC_TEMPLATE_TYPE_CODES),
    formCode: vine.string().trim().maxLength(20).optional().nullable(),
    status: vine.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
  })
)

export const updateContractTemplateValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(2).maxLength(50).optional(),
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    description: vine.string().trim().maxLength(2000).optional().nullable(),
    templateType: vine.enum(DOC_TEMPLATE_TYPE_CODES).optional(),
    formCode: vine.string().trim().maxLength(20).optional().nullable(),
    status: vine.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
  })
)

export const updateContractTemplateStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(['ACTIVE', 'INACTIVE'] as const),
  })
)
