import University from '#models/university'
import Country from '#models/country'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  UniversityRegion,
  UniversitySchoolBlock,
  UniversityStatus,
} from '#types/university'

export interface UniversityFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  region?: string
  schoolBlock?: string
  countryId?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

/** Service danh mục trường đại học. */
export default class UniversityService {
  /** Lấy id quốc gia Việt Nam (mã VN) để làm mặc định. */
  static async resolveVietnamCountryId(): Promise<number | null> {
    const vn = await Country.query().where('code', 'VN').first()
    return vn?.id ?? null
  }

  private static applyFilters(
    q: ModelQueryBuilderContract<typeof University, University>,
    filters: UniversityFilters,
    defaultStatus?: UniversityStatus
  ) {
    const status = (filters.status as UniversityStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)
    if (filters.region) q.where('region', filters.region)
    if (filters.schoolBlock) q.where('school_block', filters.schoolBlock)
    if (filters.countryId) q.where('country_id', filters.countryId)
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof University, University>,
    filters: UniversityFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order === 'desc' ? 'desc' : 'asc'
    const valid = ['display_order', 'created_at', 'code', 'name', 'status', 'region']
    const col = valid.includes(sortBy) ? sortBy : 'display_order'
    if (col === 'display_order') {
      q.orderBy('display_order', order).orderBy('name', 'asc')
    } else {
      q.orderBy(col, order)
    }
  }

  static async paginate(
    filters: UniversityFilters = {}
  ): Promise<ModelPaginatorContract<University>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 100)
    const q = University.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  static async listCatalogOptions(filters: UniversityFilters = {}): Promise<University[]> {
    const q = University.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  static async findById(id: number): Promise<University> {
    const item = await University.find(id)
    if (!item) throw new Error('UNIVERSITY_NOT_FOUND')
    return item
  }

  /** Map country_id → { id, code, name } để serialize. */
  static async mapCountriesByIds(
    ids: number[]
  ): Promise<Map<number, { id: number; code: string; name: string }>> {
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))]
    const map = new Map<number, { id: number; code: string; name: string }>()
    if (!unique.length) return map
    const rows = await Country.query().whereIn('id', unique)
    for (const c of rows) {
      map.set(c.id, { id: c.id, code: c.code, name: c.name })
    }
    return map
  }

  static async create(payload: {
    code: string
    name: string
    region?: UniversityRegion
    schoolBlock?: UniversitySchoolBlock
    countryId?: number | null
    isPrivate?: boolean
    displayOrder?: number
    status?: UniversityStatus
  }): Promise<University> {
    const code = payload.code.trim().toUpperCase()
    const existed = await University.query().where('code', code).first()
    if (existed) throw new Error('CODE_EXISTS')
    const countryId =
      payload.countryId !== undefined
        ? payload.countryId
        : await this.resolveVietnamCountryId()
    return University.create({
      code,
      name: payload.name.trim(),
      // Tạm giữ mặc định khi UI ẩn khu vực/khối
      region: payload.region ?? 'HA_NOI',
      schoolBlock: payload.schoolBlock ?? 'CIVIL',
      countryId: countryId ?? null,
      isPrivate: payload.isPrivate ?? false,
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(
    id: number,
    payload: {
      code?: string
      name?: string
      region?: UniversityRegion
      schoolBlock?: UniversitySchoolBlock
      countryId?: number | null
      isPrivate?: boolean
      displayOrder?: number
      status?: UniversityStatus
    }
  ): Promise<University> {
    const item = await this.findById(id)
    if (payload.code !== undefined) {
      const code = payload.code.trim().toUpperCase()
      const dup = await University.query().where('code', code).whereNot('id', id).first()
      if (dup) throw new Error('CODE_EXISTS')
      item.code = code
    }
    if (payload.name !== undefined) item.name = payload.name.trim()
    if (payload.region !== undefined) item.region = payload.region
    if (payload.schoolBlock !== undefined) item.schoolBlock = payload.schoolBlock
    if (payload.countryId !== undefined) item.countryId = payload.countryId
    if (payload.isPrivate !== undefined) item.isPrivate = payload.isPrivate
    if (payload.displayOrder !== undefined) item.displayOrder = payload.displayOrder
    if (payload.status !== undefined) item.status = payload.status
    await item.save()
    return item
  }

  static async changeStatus(id: number, status: UniversityStatus): Promise<University> {
    const item = await this.findById(id)
    item.status = status
    await item.save()
    return item
  }
}
