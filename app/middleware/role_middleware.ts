import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { UserRole } from '#types/user'

/**
 * Middleware kiểm tra role của user.
 * Dùng: Route.middleware(['auth', 'role:ADMIN,PHONG_KH'])
 * Cho phép nếu user có một trong các role được liệt kê.
 */
export default class RoleMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    rolesParam: string | string[]
  ) {
    const user = ctx.auth.use('api').user
    if (!user) {
      return ctx.response.unauthorized({
        success: false,
        message: 'Chưa đăng nhập.',
      })
    }

    const roles = typeof rolesParam === 'string'
      ? rolesParam.split(',').map((r) => r.trim())
      : rolesParam
    const allowedRoles = roles as UserRole[]
    if (!allowedRoles.length || !allowedRoles.includes(user.role)) {
      return ctx.response.forbidden({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này.',
      })
    }

    return next()
  }
}
