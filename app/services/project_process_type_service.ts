import ProjectProcessType from '#models/project_process_type'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ProjectProcessTypeStatus } from '#models/project_process_type'

export interface ProjectProcessTypeFilters {
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
  description?: string | null
  displayOrder?: number
  status?: ProjectProcessTypeStatus
}

interface UpdatePayload {
  code?: string
  name?: string
  description?: string | null
  displayOrder?: number
  status?: ProjectProcessTypeStatus
}

/**
 * Service quản lý danh mục loại quy trình đề tài.
 */
export default class ProjectProcessTypeService {
  private static applyFilters(
    q: ModelQueryBuilderContract<typeof ProjectProcessType, ProjectProcessType>,
    filters: ProjectProcessTypeFilters,
    defaultStatus?: ProjectProcessTypeStatus
  ) {
    const status = (filters.status as ProjectProcessTypeStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`)
          .orWhereILike('name', `%${filters.keyword}%`)
          .orWhereILike('description', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof ProjectProcessType, ProjectProcessType>,
    filters: ProjectProcessTypeFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order ?? 'asc'
    const validSortColumns = ['display_order', 'created_at', 'code', 'name', 'status']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'display_order'
    const sortOrder = order === 'desc' ? 'desc' : 'asc'

    if (sortColumn === 'display_order') {
      q.orderBy('display_order', sortOrder).orderBy('code', 'asc')
    } else {
      q.orderBy(sortColumn, sortOrder)
    }
  }

  static async paginateCatalog(
    filters: ProjectProcessTypeFilters = {}
  ): Promise<ModelPaginatorContract<ProjectProcessType>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 500, 1000)
    const q = ProjectProcessType.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  static async listCatalogOptions(
    filters: ProjectProcessTypeFilters = {}
  ): Promise<ProjectProcessType[]> {
    const q = ProjectProcessType.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  static async findActiveById(id: number): Promise<ProjectProcessType> {
    const row = await ProjectProcessType.query().where('id', id).where('status', 'ACTIVE').first()
    if (!row) throw new Error('PROJECT_PROCESS_TYPE_NOT_FOUND')
    return row
  }

  static async paginate(
    filters: ProjectProcessTypeFilters = {}
  ): Promise<ModelPaginatorContract<ProjectProcessType>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 1000)
    const q = ProjectProcessType.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<ProjectProcessType> {
    const row = await ProjectProcessType.find(id)
    if (!row) throw new Error('PROJECT_PROCESS_TYPE_NOT_FOUND')
    return row
  }

  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = ProjectProcessType.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    return !!(await q.first())
  }

  static async create(payload: CreatePayload): Promise<ProjectProcessType> {
    if (await this.isCodeExists(payload.code)) throw new Error('CODE_EXISTS')
    return ProjectProcessType.create({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(id: number, payload: UpdatePayload): Promise<ProjectProcessType> {
    const row = await this.findById(id)
    if (payload.code !== undefined) {
      const code = payload.code.trim().toUpperCase()
      if (await this.isCodeExists(code, id)) throw new Error('CODE_EXISTS')
      row.code = code
    }
    if (payload.name !== undefined) row.name = payload.name.trim()
    if (payload.description !== undefined) {
      row.description = payload.description?.trim() || null
    }
    if (payload.displayOrder !== undefined) row.displayOrder = payload.displayOrder
    if (payload.status !== undefined) row.status = payload.status
    await row.save()
    return row
  }

  static async updateStatus(
    id: number,
    status: ProjectProcessTypeStatus
  ): Promise<ProjectProcessType> {
    const row = await this.findById(id)
    row.status = status
    await row.save()
    return row
  }
}
