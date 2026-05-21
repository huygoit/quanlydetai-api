import Department from '#models/department'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { DepartmentType, DepartmentStatus } from '#models/department'

/** Loại đơn vị thuộc nhóm khoa / phòng / ban (loại trừ cấp trường) */
const KHOA_PHONG_BAN_TYPES: DepartmentType[] = [
  'FACULTY',
  'OFFICE',
  'CENTER',
  'BOARD',
  'COUNCIL',
  'OTHER',
]

export type DepartmentCatalogScope = 'all' | 'khoa_phong_ban' | 'truong'

export interface DepartmentFilters {
  page?: number
  perPage?: number
  keyword?: string
  type?: string
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface DepartmentCatalogFilters extends DepartmentFilters {
  scope?: DepartmentCatalogScope
}

interface CreatePayload {
  code: string
  name: string
  shortName?: string | null
  type: DepartmentType
  displayOrder?: number
  status?: DepartmentStatus
  note?: string | null
}

interface UpdatePayload {
  code?: string
  name?: string
  shortName?: string | null
  type?: DepartmentType
  displayOrder?: number
  status?: DepartmentStatus
  note?: string | null
}

/**
 * Service quản lý danh mục đơn vị (department).
 */
export default class DepartmentService {
  /**
   * Áp dụng bộ lọc catalog (mặc định ACTIVE, scope preset).
   */
  private static applyCatalogFilters(
    q: ModelQueryBuilderContract<typeof Department, Department>,
    filters: DepartmentCatalogFilters
  ) {
    const status = (filters.status as DepartmentStatus | undefined) ?? 'ACTIVE'
    q.where('status', status)

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`)
          .orWhereILike('name', `%${filters.keyword}%`)
          .orWhereILike('short_name', `%${filters.keyword}%`)
      })
    }
    if (filters.type) q.where('type', filters.type as DepartmentType)

    const scope = filters.scope ?? 'all'
    if (scope === 'khoa_phong_ban') {
      q.whereIn('type', KHOA_PHONG_BAN_TYPES)
    } else if (scope === 'truong') {
      q.where('type', 'UNIVERSITY')
    }
  }

  /**
   * Sắp xếp catalog: mặc định display_order ASC, name ASC.
   */
  private static applyCatalogSort(
    q: ModelQueryBuilderContract<typeof Department, Department>,
    filters: DepartmentCatalogFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order ?? 'asc'
    const validSortColumns = ['display_order', 'name', 'code']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'display_order'
    const sortOrder = order === 'desc' ? 'desc' : 'asc'

    if (sortColumn === 'display_order') {
      q.orderBy('display_order', sortOrder).orderBy('name', 'asc')
    } else {
      q.orderBy(sortColumn, sortOrder)
    }
  }

  /**
   * Danh sách catalog có phân trang (đọc chung, mặc định ACTIVE).
   */
  static async paginateCatalog(
    filters: DepartmentCatalogFilters = {}
  ): Promise<ModelPaginatorContract<Department>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 500, 1000)
    const q = Department.query()
    this.applyCatalogFilters(q, filters)
    this.applyCatalogSort(q, filters)
    return q.paginate(page, perPage)
  }

  /**
   * Danh sách gọn cho dropdown (không phân trang, tối đa 1000 bản ghi).
   */
  static async listCatalogOptions(
    filters: DepartmentCatalogFilters = {}
  ): Promise<Department[]> {
    const q = Department.query()
    this.applyCatalogFilters(q, filters)
    this.applyCatalogSort(q, filters)
    return q.limit(1000)
  }

  /**
   * Chi tiết catalog: chỉ đơn vị ACTIVE.
   */
  static async findActiveById(id: number): Promise<Department> {
    const dept = await Department.query().where('id', id).where('status', 'ACTIVE').first()
    if (!dept) {
      throw new Error('DEPARTMENT_NOT_FOUND')
    }
    return dept
  }

  /**
   * Danh sách có phân trang, filter, search.
   */
  static async paginate(
    filters: DepartmentFilters = {}
  ): Promise<ModelPaginatorContract<Department>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 10, 100)
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order ?? 'asc'

    const q = Department.query()

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`)
          .orWhereILike('name', `%${filters.keyword}%`)
          .orWhereILike('short_name', `%${filters.keyword}%`)
      })
    }
    if (filters.type) q.where('type', filters.type)
    if (filters.status) q.where('status', filters.status)

    const validSortColumns = ['display_order', 'created_at', 'code', 'name', 'type', 'status']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'display_order'
    const sortOrder = order === 'desc' ? 'desc' : 'asc'

    if (sortColumn === 'display_order') {
      q.orderBy('display_order', sortOrder).orderBy('created_at', 'desc')
    } else {
      q.orderBy(sortColumn, sortOrder)
    }

    return q.paginate(page, perPage)
  }

  /**
   * Lấy chi tiết theo id. Throw nếu không tìm thấy.
   */
  static async findById(id: number): Promise<Department> {
    const dept = await Department.find(id)
    if (!dept) {
      throw new Error('DEPARTMENT_NOT_FOUND')
    }
    return dept
  }

  /**
   * Kiểm tra code đã tồn tại chưa (trừ id nếu có).
   */
  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = Department.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  /**
   * Tạo mới department.
   */
  static async create(payload: CreatePayload): Promise<Department> {
    const exists = await this.isCodeExists(payload.code)
    if (exists) {
      throw new Error('CODE_EXISTS')
    }

    return Department.create({
      code: payload.code,
      name: payload.name,
      shortName: payload.shortName ?? null,
      type: payload.type,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
      note: payload.note ?? null,
    })
  }

  /**
   * Cập nhật department.
   */
  static async update(id: number, payload: UpdatePayload): Promise<Department> {
    const dept = await this.findById(id)

    if (payload.code !== undefined) {
      const exists = await this.isCodeExists(payload.code, id)
      if (exists) {
        throw new Error('CODE_EXISTS')
      }
      dept.code = payload.code
    }
    if (payload.name !== undefined) dept.name = payload.name
    if (payload.shortName !== undefined) dept.shortName = payload.shortName ?? null
    if (payload.type !== undefined) dept.type = payload.type
    if (payload.displayOrder !== undefined) dept.displayOrder = payload.displayOrder
    if (payload.status !== undefined) dept.status = payload.status
    if (payload.note !== undefined) dept.note = payload.note ?? null

    await dept.save()
    return dept
  }

  /**
   * Cập nhật riêng trạng thái.
   */
  static async updateStatus(id: number, status: DepartmentStatus): Promise<Department> {
    const dept = await this.findById(id)
    dept.status = status
    await dept.save()
    return dept
  }
}
