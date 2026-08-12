import StaffPosition from '#models/staff_position'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { StaffPositionStatus } from '#models/staff_position'
import type { StaffPositionKind } from '#types/staff_position'

export interface StaffPositionFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  kind?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

interface CreatePayload {
  kind: StaffPositionKind
  code: string
  name: string
  displayOrder?: number
  status?: StaffPositionStatus
}

interface UpdatePayload {
  kind?: StaffPositionKind
  code?: string
  name?: string
  displayOrder?: number
  status?: StaffPositionStatus
}

/**
 * Service quản lý danh mục chức vụ nhân sự.
 */
export default class StaffPositionService {
  /** Lọc dùng chung cho catalog & admin */
  private static applyFilters(
    q: ModelQueryBuilderContract<typeof StaffPosition, StaffPosition>,
    filters: StaffPositionFilters,
    defaultStatus?: StaffPositionStatus
  ) {
    const status = (filters.status as StaffPositionStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)

    if (filters.kind) q.where('kind', filters.kind)

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof StaffPosition, StaffPosition>,
    filters: StaffPositionFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order ?? 'asc'
    const validSortColumns = ['display_order', 'created_at', 'code', 'name', 'status', 'kind']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'display_order'
    const sortOrder = order === 'desc' ? 'desc' : 'asc'

    if (sortColumn === 'display_order') {
      q.orderBy('kind', 'asc').orderBy('display_order', sortOrder).orderBy('name', 'asc')
    } else {
      q.orderBy(sortColumn, sortOrder)
    }
  }

  /** Catalog có phân trang (mặc định ACTIVE). */
  static async paginateCatalog(
    filters: StaffPositionFilters = {}
  ): Promise<ModelPaginatorContract<StaffPosition>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 500, 1000)
    const q = StaffPosition.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  /** Danh sách gọn cho dropdown (không phân trang). */
  static async listCatalogOptions(filters: StaffPositionFilters = {}): Promise<StaffPosition[]> {
    const q = StaffPosition.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  /** Chi tiết catalog: chỉ bản ghi ACTIVE. */
  static async findActiveById(id: number): Promise<StaffPosition> {
    const item = await StaffPosition.query().where('id', id).where('status', 'ACTIVE').first()
    if (!item) {
      throw new Error('STAFF_POSITION_NOT_FOUND')
    }
    return item
  }

  /** Danh sách admin có phân trang. */
  static async paginate(
    filters: StaffPositionFilters = {}
  ): Promise<ModelPaginatorContract<StaffPosition>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 1000)
    const q = StaffPosition.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<StaffPosition> {
    const item = await StaffPosition.find(id)
    if (!item) {
      throw new Error('STAFF_POSITION_NOT_FOUND')
    }
    return item
  }

  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = StaffPosition.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  static async create(payload: CreatePayload): Promise<StaffPosition> {
    const exists = await this.isCodeExists(payload.code)
    if (exists) {
      throw new Error('CODE_EXISTS')
    }

    return StaffPosition.create({
      kind: payload.kind,
      code: payload.code,
      name: payload.name,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(id: number, payload: UpdatePayload): Promise<StaffPosition> {
    const item = await this.findById(id)

    if (payload.code !== undefined) {
      const exists = await this.isCodeExists(payload.code, id)
      if (exists) {
        throw new Error('CODE_EXISTS')
      }
      item.code = payload.code
    }
    if (payload.kind !== undefined) item.kind = payload.kind
    if (payload.name !== undefined) item.name = payload.name
    if (payload.displayOrder !== undefined) item.displayOrder = payload.displayOrder
    if (payload.status !== undefined) item.status = payload.status

    await item.save()
    return item
  }

  static async updateStatus(id: number, status: StaffPositionStatus): Promise<StaffPosition> {
    const item = await this.findById(id)
    item.status = status
    await item.save()
    return item
  }
}
