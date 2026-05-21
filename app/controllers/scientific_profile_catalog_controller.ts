import type { HttpContext } from '@adonisjs/core/http'
import {
  listScientificProfileAcademicTitleOptions,
  listScientificProfileDegreeOptions,
} from '#constants/scientific_profile_catalog'

/**
 * Catalog đọc: học vị / học hàm hồ sơ khoa học.
 */
export default class ScientificProfileCatalogController {
  /**
   * GET /api/catalog/scientific-profile/options
   */
  async options({ response }: HttpContext) {
    return response.ok({
      success: true,
      message: 'Scientific profile catalog options fetched successfully',
      data: {
        degrees: listScientificProfileDegreeOptions(),
        academicTitles: listScientificProfileAcademicTitleOptions(),
      },
    })
  }

  /**
   * GET /api/catalog/scientific-profile/degrees/options
   */
  async degreeOptions({ response }: HttpContext) {
    return response.ok({
      success: true,
      data: listScientificProfileDegreeOptions(),
    })
  }

  /**
   * GET /api/catalog/scientific-profile/academic-titles/options
   */
  async academicTitleOptions({ response }: HttpContext) {
    return response.ok({
      success: true,
      data: listScientificProfileAcademicTitleOptions(),
    })
  }
}
