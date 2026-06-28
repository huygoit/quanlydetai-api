import Specialization from '#models/specialization'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { SpecializationStatus } from '#models/specialization'

export interface SpecializationFilters {
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
  status?: SpecializationStatus
}

interface UpdatePayload {
  code?: string
  name?: string
  displayOrder?: number
  status?: SpecializationStatus
}

/**
 * Service quản lý danh mục chuyên ngành (specialization).
 */
export default class SpecializationService {
  /** Lọc dùng chung cho catalog & admin */
  private static applyFilters(
    q: ModelQueryBuilderContract<typeof Specialization, Specialization>,
    filters: SpecializationFilters,
    defaultStatus?: SpecializationStatus
  ) {
    const status = (filters.status as SpecializationStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof Specialization, Specialization>,
    filters: SpecializationFilters
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
  static async paginateCatalog(
    filters: SpecializationFilters = {}
  ): Promise<ModelPaginatorContract<Specialization>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 500, 1000)
    const q = Specialization.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  /** Danh sách gọn cho dropdown (không phân trang). */
  static async listCatalogOptions(
    filters: SpecializationFilters = {}
  ): Promise<Specialization[]> {
    const q = Specialization.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  /** Chi tiết catalog: chỉ chuyên ngành ACTIVE. */
  static async findActiveById(id: number): Promise<Specialization> {
    const item = await Specialization.query().where('id', id).where('status', 'ACTIVE').first()
    if (!item) {
      throw new Error('SPECIALIZATION_NOT_FOUND')
    }
    return item
  }

  /** Danh sách admin có phân trang, filter, search. */
  static async paginate(
    filters: SpecializationFilters = {}
  ): Promise<ModelPaginatorContract<Specialization>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 1000)
    const q = Specialization.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  /** Lấy chi tiết theo id. Throw nếu không tìm thấy. */
  static async findById(id: number): Promise<Specialization> {
    const item = await Specialization.find(id)
    if (!item) {
      throw new Error('SPECIALIZATION_NOT_FOUND')
    }
    return item
  }

  /** Kiểm tra code đã tồn tại chưa (trừ id nếu có). */
  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = Specialization.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  /** Tạo mới chuyên ngành. */
  static async create(payload: CreatePayload): Promise<Specialization> {
    const exists = await this.isCodeExists(payload.code)
    if (exists) {
      throw new Error('CODE_EXISTS')
    }

    return Specialization.create({
      code: payload.code,
      name: payload.name,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  /** Cập nhật chuyên ngành. */
  static async update(id: number, payload: UpdatePayload): Promise<Specialization> {
    const item = await this.findById(id)

    if (payload.code !== undefined) {
      const exists = await this.isCodeExists(payload.code, id)
      if (exists) {
        throw new Error('CODE_EXISTS')
      }
      item.code = payload.code
    }
    if (payload.name !== undefined) item.name = payload.name
    if (payload.displayOrder !== undefined) item.displayOrder = payload.displayOrder
    if (payload.status !== undefined) item.status = payload.status

    await item.save()
    return item
  }

  /** Cập nhật riêng trạng thái. */
  static async updateStatus(id: number, status: SpecializationStatus): Promise<Specialization> {
    const item = await this.findById(id)
    item.status = status
    await item.save()
    return item
  }
}
