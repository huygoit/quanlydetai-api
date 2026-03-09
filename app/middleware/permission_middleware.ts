import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import PermissionService from '#services/permission_service'

/**
 * Middleware kiểm tra permission của user.
 * Dùng: Route.middleware(['auth', 'permission:department.view'])
 * Hoặc nhiều permission (OR): Route.middleware(['auth', 'permission:role.view,role.create'])
 * User cần có ít nhất 1 trong các permission.
 */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, permissionCodes: string | string[]) {
    const user = ctx.auth.use('api').user
    if (!user) {
      return ctx.response.unauthorized({
        success: false,
        message: 'Chưa đăng nhập.',
      })
    }

    const codes = typeof permissionCodes === 'string'
      ? permissionCodes.split(',').map((c) => c.trim())
      : permissionCodes

    if (!codes.length) {
      return ctx.response.forbidden({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này.',
      })
    }

    for (const code of codes) {
      const has = await PermissionService.userHasPermission(user.id, code)
      if (has) return next()
    }

    return ctx.response.forbidden({
      success: false,
      message: 'Bạn không có quyền thực hiện thao tác này.',
    })
  }
}
