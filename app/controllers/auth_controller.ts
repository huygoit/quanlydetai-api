import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import AuthProfileService from '#services/auth_profile_service'
import { loginValidator } from '#validators/login_validator'
import { authRegisterValidator } from '#validators/auth_register_validator'

/**
 * Controller xử lý đăng nhập, đăng ký, đăng xuất và lấy thông tin user hiện tại.
 */
export default class AuthController {
  /**
   * POST /api/auth/register
   * Đăng ký tài khoản mới bằng email + password. Tự động cấp token sau khi đăng ký.
   */
  async register({ request, response, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(authRegisterValidator)

    try {
      const existing = await User.findBy('email', email)
      if (existing) {
        return response.badRequest({
          success: false,
          message: 'Email đã tồn tại.',
        })
      }

      // Tạo fullName từ phần trước @ của email (hoặc "User" nếu rỗng)
      const fullName = email.split('@')[0]?.trim() || 'User'

      const user = await User.create({
        email,
        password,
        fullName,
        role: 'NCV',
        roleLabel: 'Nhà khoa học',
        isActive: true,
      })

      const token = await auth.use('api').createToken(user, ['*'], {
        expiresIn: '30 days',
        name: 'auth',
      })

      const tokenJson = token.toJSON()

      return response.created({
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
      const message = err instanceof Error ? err.message : 'Lỗi đăng ký.'
      const stack = err instanceof Error ? err.stack : undefined
      return response.internalServerError({
        success: false,
        message: 'Lỗi máy chủ khi đăng ký.',
        ...(process.env.NODE_ENV !== 'production' && { debug: message, stack }),
      })
    }
  }

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
   * Trả về thông tin user đang đăng nhập kèm roles, permissions, department cho access control.
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const data = await AuthProfileService.getMeData(user)
    return response.ok({
      success: true,
      data,
    })
  }

  /** Chuẩn hóa user để trả về API (dùng cho login/register) */
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
