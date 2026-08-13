import type { HttpContext } from '@adonisjs/core/http'
import UniversityService from '#services/university_service'
import {
  UNIVERSITY_REGION_LABELS,
  UNIVERSITY_SCHOOL_BLOCK_LABELS,
  type UniversityRegion,
  type UniversitySchoolBlock,
} from '#types/university'

/** Catalog trường ĐH — đọc, chỉ cần đăng nhập. */
export default class UniversitiesController {
  /** GET /api/universities/options */
  async options({ request, response }: HttpContext) {
    const countryIdRaw = request.input('countryId', request.input('country_id', ''))
    const countryId = countryIdRaw ? Number(countryIdRaw) : undefined
    const rows = await UniversityService.listCatalogOptions({
      keyword: request.input('keyword', '') || undefined,
      region: request.input('region', '') || undefined,
      schoolBlock: request.input('schoolBlock', '') || request.input('school_block', '') || undefined,
      countryId: Number.isFinite(countryId) ? countryId : undefined,
    })
    const countryMap = await UniversityService.mapCountriesByIds(
      rows.map((u) => u.countryId).filter((id): id is number => id != null)
    )
    return response.ok({
      success: true,
      data: rows.map((u) => {
        const country = u.countryId ? countryMap.get(u.countryId) : null
        return {
          id: u.id,
          code: u.code,
          name: u.name,
          label: u.name,
          value: u.name,
          region: u.region,
          region_label: UNIVERSITY_REGION_LABELS[u.region as UniversityRegion] ?? u.region,
          school_block: u.schoolBlock,
          school_block_label:
            UNIVERSITY_SCHOOL_BLOCK_LABELS[u.schoolBlock as UniversitySchoolBlock] ?? u.schoolBlock,
          country_id: u.countryId != null ? Number(u.countryId) : null,
          country_name: country?.name ?? null,
          is_private: u.isPrivate,
        }
      }),
    })
  }
}
