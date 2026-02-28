import vine from '@vinejs/vine'

const AFFILIATION_TYPES = ['UDN_ONLY', 'MIXED', 'OUTSIDE'] as const

/** Schema một tác giả trong danh sách PUT /publications/:id/authors (chấp nhận snake_case theo spec) */
const authorSchema = vine.object({
  id: vine.number().optional(),
  profile_id: vine.number().optional(),
  full_name: vine.string().trim().minLength(1).maxLength(255),
  author_order: vine.number().min(1),
  is_main_author: vine.boolean(),
  is_corresponding: vine.boolean(),
  affiliation_type: vine.enum(AFFILIATION_TYPES),
  is_multi_affiliation_outside_udn: vine.boolean(),
})

/** Kiểm tra p >= 1, n >= 1, n <= p, author_order unique. Gọi từ controller sau khi validate. */
export function validateAuthorsListRules(authors: Array<{ author_order: number; is_main_author: boolean }>): void {
  const p = authors.length
  if (p < 1) {
    throw new vine.exceptions.E_VALIDATION_ERROR({
      messages: [{ field: 'authors', message: 'Cần ít nhất 1 tác giả', rule: 'minLength' }],
    })
  }
  const n = authors.filter((a) => a.is_main_author).length
  if (n < 1) {
    throw new vine.exceptions.E_VALIDATION_ERROR({
      messages: [{ field: 'authors', message: 'Cần ít nhất 1 tác giả chính (is_main_author)', rule: 'minLength' }],
    })
  }
  if (n > p) {
    throw new vine.exceptions.E_VALIDATION_ERROR({
      messages: [{ field: 'authors', message: 'Số tác giả chính (n) không được lớn hơn tổng số tác giả (p)', rule: 'custom' }],
    })
  }
  const orders = authors.map((a) => a.author_order)
  const uniqueOrders = new Set(orders)
  if (uniqueOrders.size !== orders.length) {
    throw new vine.exceptions.E_VALIDATION_ERROR({
      messages: [{ field: 'authors', message: 'author_order phải duy nhất trong danh sách', rule: 'unique' }],
    })
  }
}

export const upsertPublicationAuthorsValidator = vine.compile(
  vine.object({
    authors: vine.array(authorSchema),
  })
)
