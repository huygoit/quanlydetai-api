import type { HttpContext } from '@adonisjs/core/http'
import CountryService from '#services/country_service'

/** Catalog quốc gia — đọc, chỉ cần đăng nhập. */
export default class CountriesController {
  /** GET /api/countries/options */
  async options({ response }: HttpContext) {
    const rows = await CountryService.listCatalogOptions({})
    return response.ok({
      success: true,
      data: rows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        label: c.name,
        value: c.name,
      })),
    })
  }
}
