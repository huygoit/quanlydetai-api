import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ScientificProfileAdminService from '#services/scientific_profile_admin_service'

/**
 * Chặn tài khoản ADMIN/SUPER_ADMIN truy cập workspace cá nhân (hồ sơ NCV, ý tưởng của tôi, …).
 */
export default class PersonalWorkspaceMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn) {
    const user = auth.user
    if (!user) {
      return response.unauthorized({ success: false, message: 'Chưa đăng nhập' })
    }

    if (await ScientificProfileAdminService.userHasAdminKeKhaiRole(user.id)) {
      return response.forbidden({
        success: false,
        message:
          'Tài khoản quản trị không dùng chức năng cá nhân. Vui lòng dùng tài khoản NCV hoặc trang quản lý hệ thống.',
      })
    }

    return next()
  }
}
