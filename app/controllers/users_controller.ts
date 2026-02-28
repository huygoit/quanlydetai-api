import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createUserValidator } from '#validators/create_user_validator'
import { updateUserValidator } from '#validators/update_user_validator'

/**
 * Controller CRUD users (chỉ ADMIN).
 * GET /api/users: phân trang, filter keyword, role, unit, isActive.
 * GET/POST/PUT/DELETE /api/users/:id
 */
export default class UsersController {
  /**
   * GET /api/users
   * Query: page, perPage, keyword, role, unit, isActive
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const role = request.input('role', '')
    const unit = request.input('unit', '')
    const isActive = request.input('isActive', '')

    const q = User.query().orderBy('id', 'desc')

    if (keyword) {
      q.where((builder) => {
        builder
          .whereILike('email', `%${keyword}%`)
          .orWhereILike('full_name', `%${keyword}%`)
          .orWhereILike('unit', `%${keyword}%`)
      })
    }
    if (role) q.where('role', role)
    if (unit) q.whereILike('unit', `%${unit}%`)
    if (isActive !== '') {
      const active = isActive === 'true' || isActive === '1'
      q.where('is_active', active)
    }

    const paginated = await q.paginate(page, perPage)
    const serialized = paginated.all().map((u) => this.serializeUser(u))

    return response.ok({
      success: true,
      data: serialized,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /**
   * GET /api/users/:id
   */
  async show({ params, response }: HttpContext) {
    const user = await User.find(params.id)
    if (!user) {
      return response.notFound({ success: false, message: 'Không tìm thấy user.' })
    }
    return response.ok({
      success: true,
      data: this.serializeUser(user),
    })
  }

  /**
   * POST /api/users
   */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)
    const existing = await User.findBy('email', payload.email)
    if (existing) {
      return response.badRequest({
        success: false,
        message: 'Email đã được sử dụng.',
        errors: [{ field: 'email', message: 'Email đã tồn tại trong hệ thống.' }],
      })
    }
    const user = await User.create({
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
      role: payload.role,
      roleLabel: payload.roleLabel ?? null,
      unit: payload.unit ?? null,
      phone: payload.phone ?? null,
      isActive: true,
    })
    return response.created({
      success: true,
      data: this.serializeUser(user),
    })
  }

  /**
   * PUT /api/users/:id
   */
  async update({ params, request, response }: HttpContext) {
    const user = await User.find(params.id)
    if (!user) {
      return response.notFound({ success: false, message: 'Không tìm thấy user.' })
    }
    const payload = await request.validateUsing(updateUserValidator)
    if (payload.email !== undefined) {
      if (payload.email !== user.email) {
        const existing = await User.findBy('email', payload.email)
        if (existing) {
          return response.badRequest({
            success: false,
            message: 'Email đã được sử dụng.',
            errors: [{ field: 'email', message: 'Email đã tồn tại trong hệ thống.' }],
          })
        }
      }
      user.email = payload.email
    }
    if (payload.fullName !== undefined) user.fullName = payload.fullName
    if (payload.role !== undefined) user.role = payload.role
    if (payload.roleLabel !== undefined) user.roleLabel = payload.roleLabel ?? null
    if (payload.unit !== undefined) user.unit = payload.unit ?? null
    if (payload.phone !== undefined) user.phone = payload.phone ?? null
    if (payload.isActive !== undefined) user.isActive = payload.isActive

    await user.save()
    return response.ok({
      success: true,
      data: this.serializeUser(user),
    })
  }

  /**
   * DELETE /api/users/:id
   * Soft delete: set isActive = false
   */
  async destroy({ params, response }: HttpContext) {
    const user = await User.find(params.id)
    if (!user) {
      return response.notFound({ success: false, message: 'Không tìm thấy user.' })
    }
    user.isActive = false
    await user.save()
    return response.ok({
      success: true,
      message: 'Đã vô hiệu hóa user.',
    })
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      roleLabel: user.roleLabel ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      phone: user.phone ?? undefined,
      unit: user.unit ?? undefined,
      isActive: user.isActive,
      createdAt: user.createdAt.toISO(),
      updatedAt: user.updatedAt?.toISO(),
    }
  }
}
