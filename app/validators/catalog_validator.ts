import vine from '@vinejs/vine'

/**
 * Validator tạo catalog (POST /api/admin/catalogs).
 */
export const createCatalogValidator = vine.compile(
  vine.object({
    type: vine.string().trim().minLength(1).maxLength(50),
    code: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    sortOrder: vine.number().optional(),
    isActive: vine.boolean().optional(),
    parentId: vine.number().optional(),
    metadata: vine.any().optional(),
  })
)

/**
 * Validator cập nhật catalog (PUT /api/admin/catalogs/:id).
 */
export const updateCatalogValidator = vine.compile(
  vine.object({
    type: vine.string().trim().minLength(1).maxLength(50).optional(),
    code: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    sortOrder: vine.number().optional(),
    isActive: vine.boolean().optional(),
    parentId: vine.number().optional(),
    metadata: vine.any().optional(),
  })
)
