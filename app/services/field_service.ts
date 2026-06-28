import Field from '#models/field'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { FieldStatus } from '#models/field'

export interface FieldFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

interface CreatePayload {
  code: string
  name: string
  displayOrder?: number
  status?: FieldStatus
}

interface UpdatePayload {
  code?: string
  name?: string
  displayOrder?: number
  status?: FieldStatus
}

/**
 * Service quản lý danh mục lĩnh vực (field).
 */
export default class FieldService {
  /** Lọc + sắp xếp dùng chung cho catalog & admin */
  private static applyFilters(
    q: ModelQueryBuilderContract<typeof Field, Field>,
    filters: FieldFilters,
    defaultStatus?: FieldStatus
  ) {
    const status = (filters.status as FieldStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof Field, Field>,
    filters: FieldFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order ?? 'asc'
    const validSortColumns = ['display_order', 'created_at', 'code', 'name', 'status']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'display_order'
    const sortOrder = order === 'desc' ? 'desc' : 'asc'

    if (sortColumn === 'display_order') {
      q.orderBy('display_order', sortOrder).orderBy('name', 'asc')
    } else {
      q.orderBy(sortColumn, sortOrder)
    }
  }

  /** Catalog có phân trang (đọc chung, mặc định ACTIVE). */
  static async paginateCatalog(filters: FieldFilters = {}): Promise<ModelPaginatorContract<Field>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 500, 1000)
    const q = Field.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  /** Danh sách gọn cho dropdown (không phân trang). */
  static async listCatalogOptions(filters: FieldFilters = {}): Promise<Field[]> {
    const q = Field.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  /** Chi tiết catalog: chỉ lĩnh vực ACTIVE. */
  static async findActiveById(id: number): Promise<Field> {
    const field = await Field.query().where('id', id).where('status', 'ACTIVE').first()
    if (!field) {
      throw new Error('FIELD_NOT_FOUND')
    }
    return field
  }

  /** Danh sách admin có phân trang, filter, search. */
  static async paginate(filters: FieldFilters = {}): Promise<ModelPaginatorContract<Field>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 1000)
    const q = Field.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  /** Lấy chi tiết theo id. Throw nếu không tìm thấy. */
  static async findById(id: number): Promise<Field> {
    const field = await Field.find(id)
    if (!field) {
      throw new Error('FIELD_NOT_FOUND')
    }
    return field
  }

  /** Kiểm tra code đã tồn tại chưa (trừ id nếu có). */
  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = Field.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  /** Tạo mới lĩnh vực. */
  static async create(payload: CreatePayload): Promise<Field> {
    const exists = await this.isCodeExists(payload.code)
    if (exists) {
      throw new Error('CODE_EXISTS')
    }

    return Field.create({
      code: payload.code,
      name: payload.name,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  /** Cập nhật lĩnh vực. */
  static async update(id: number, payload: UpdatePayload): Promise<Field> {
    const field = await this.findById(id)

    if (payload.code !== undefined) {
      const exists = await this.isCodeExists(payload.code, id)
      if (exists) {
        throw new Error('CODE_EXISTS')
      }
      field.code = payload.code
    }
    if (payload.name !== undefined) field.name = payload.name
    if (payload.displayOrder !== undefined) field.displayOrder = payload.displayOrder
    if (payload.status !== undefined) field.status = payload.status

    await field.save()
    return field
  }

  /** Cập nhật riêng trạng thái. */
  static async updateStatus(id: number, status: FieldStatus): Promise<Field> {
    const field = await this.findById(id)
    field.status = status
    await field.save()
    return field
  }
}
