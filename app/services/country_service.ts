import Country from '#models/country'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { CountryStatus } from '#models/country'

export interface CountryFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

/** Service danh mục quốc gia. */
export default class CountryService {
  private static applyFilters(
    q: ModelQueryBuilderContract<typeof Country, Country>,
    filters: CountryFilters,
    defaultStatus?: CountryStatus
  ) {
    const status = (filters.status as CountryStatus | undefined) ?? defaultStatus
    if (status) q.where('status', status)
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
  }

  private static applySort(
    q: ModelQueryBuilderContract<typeof Country, Country>,
    filters: CountryFilters
  ) {
    const sortBy = filters.sortBy ?? 'display_order'
    const order = filters.order === 'desc' ? 'desc' : 'asc'
    const valid = ['display_order', 'created_at', 'code', 'name', 'status']
    const col = valid.includes(sortBy) ? sortBy : 'display_order'
    if (col === 'display_order') {
      q.orderBy('display_order', order).orderBy('name', 'asc')
    } else {
      q.orderBy(col, order)
    }
  }

  static async paginate(filters: CountryFilters = {}): Promise<ModelPaginatorContract<Country>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 20, 100)
    const q = Country.query()
    this.applyFilters(q, filters)
    this.applySort(q, filters)
    return q.paginate(page, perPage)
  }

  static async listCatalogOptions(filters: CountryFilters = {}): Promise<Country[]> {
    const q = Country.query()
    this.applyFilters(q, filters, 'ACTIVE')
    this.applySort(q, filters)
    return q.limit(1000)
  }

  static async findById(id: number): Promise<Country> {
    const item = await Country.find(id)
    if (!item) throw new Error('COUNTRY_NOT_FOUND')
    return item
  }

  static async create(payload: {
    code: string
    name: string
    displayOrder?: number
    status?: CountryStatus
  }): Promise<Country> {
    const code = payload.code.trim().toUpperCase()
    const existed = await Country.query().where('code', code).first()
    if (existed) throw new Error('CODE_EXISTS')
    return Country.create({
      code,
      name: payload.name.trim(),
      displayOrder: payload.displayOrder ?? 0,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(
    id: number,
    payload: {
      code?: string
      name?: string
      displayOrder?: number
      status?: CountryStatus
    }
  ): Promise<Country> {
    const item = await this.findById(id)
    if (payload.code !== undefined) {
      const code = payload.code.trim().toUpperCase()
      const dup = await Country.query().where('code', code).whereNot('id', id).first()
      if (dup) throw new Error('CODE_EXISTS')
      item.code = code
    }
    if (payload.name !== undefined) item.name = payload.name.trim()
    if (payload.displayOrder !== undefined) item.displayOrder = payload.displayOrder
    if (payload.status !== undefined) item.status = payload.status
    await item.save()
    return item
  }

  static async changeStatus(id: number, status: CountryStatus): Promise<Country> {
    const item = await this.findById(id)
    item.status = status
    await item.save()
    return item
  }
}
