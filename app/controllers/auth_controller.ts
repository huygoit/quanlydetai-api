import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator } from '#validators/login_validator'

/**
 * Controller xử lý đăng nhập, đăng xuất và lấy thông tin user hiện tại.
 */
export default class AuthController {
  /**
   * POST /api/auth/login
   * Xác thực email/password và trả về user + access token.
   */
  async login({ request, response, auth }: HttpContext) {
    try {
      const { email, password } = await request.validateUsing(loginValidator)

      const user = await User.verifyCredentials(email, password)

      if (!user.isActive) {
        return response.forbidden({
          success: false,
          message: 'Tài khoản đã bị vô hiệu hóa.',
        })
      }

      const token = await auth.use('api').createToken(user, ['*'], {
        expiresIn: '30 days',
        name: 'auth',
      })

      const tokenJson = token.toJSON()

      return response.ok({
        success: true,
        data: {
          user: this.serializeUser(user),
          token: {
            type: 'bearer',
            token: tokenJson.token,
            expiresAt: tokenJson.expiresAt,
          },
        },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi đăng nhập.'
      const stack = err instanceof Error ? err.stack : undefined
      return response.internalServerError({
        success: false,
        message: 'Lỗi máy chủ khi đăng nhập.',
        ...(process.env.NODE_ENV !== 'production' && { debug: message, stack }),
      })
    }
  }

  /**
   * POST /api/auth/logout
   * Thu hồi token hiện tại (đăng xuất).
   */
  async logout({ auth, response }: HttpContext) {
    await auth.use('api').invalidateToken()
    return response.ok({
      success: true,
      message: 'Đăng xuất thành công',
    })
  }

  /**
   * GET /api/auth/me
   * Trả về thông tin user đang đăng nhập.
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    return response.ok({
      success: true,
      data: this.serializeUser(user),
    })
  }

  /** Chuẩn hóa user để trả về API (không có password, đúng camelCase) */
  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      roleLabel: user.roleLabel ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      unit: user.unit ?? undefined,
    }
  }
}
