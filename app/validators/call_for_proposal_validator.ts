import vine from '@vinejs/vine'

const LEVEL_OPTIONS = ['CO_SO', 'TRUONG', 'BO', 'NHA_NUOC'] as const
const PERIOD_KIND_OPTIONS = ['ACADEMIC', 'FINANCIAL'] as const

const cfpBody = {
  title: vine.string().trim().minLength(1).maxLength(500),
  periodKind: vine.enum(PERIOD_KIND_OPTIONS),
  periodLabel: vine.string().trim().minLength(1).maxLength(30),
  deadlineAt: vine.string().trim(),
  /** Bắt buộc chọn từ danh mục loại quy trình đề tài */
  projectProcessTypeIds: vine.array(vine.number().positive()).minLength(1),
  /** Legacy — backend vẫn suy ra levels từ mã QT */
  levels: vine.array(vine.enum(LEVEL_OPTIONS)).minLength(1).optional(),
  contentHtml: vine.string().trim().optional().nullable(),
  attachmentUrls: vine.array(vine.string().trim().maxLength(500)).optional(),
}

export const createCfpValidator = vine.compile(
  vine.object({
    ...cfpBody,
  })
)

export const updateCfpValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    periodKind: vine.enum(PERIOD_KIND_OPTIONS).optional(),
    periodLabel: vine.string().trim().minLength(1).maxLength(30).optional(),
    deadlineAt: vine.string().trim().optional(),
    projectProcessTypeIds: vine.array(vine.number().positive()).minLength(1).optional(),
    levels: vine.array(vine.enum(LEVEL_OPTIONS)).minLength(1).optional(),
    contentHtml: vine.string().trim().optional().nullable(),
    attachmentUrls: vine.array(vine.string().trim().maxLength(500)).optional(),
  })
)

export const returnCfpValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

export const publishCfpValidator = vine.compile(
  vine.object({
    officialDocNo: vine.string().trim().minLength(1).maxLength(100),
    officialDocDate: vine.string().trim(),
    signedFileUrl: vine.string().trim().maxLength(500).optional().nullable(),
  })
)

export const extendCfpValidator = vine.compile(
  vine.object({
    deadlineAt: vine.string().trim(),
  })
)
