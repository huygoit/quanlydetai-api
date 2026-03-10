import type { HttpContext } from '@adonisjs/core/http'
import PersonalProfile from '#models/personal_profile'
import PersonalProfileService from '#services/personal_profile_service'
import { createPersonalProfileValidator } from '#validators/create_personal_profile_validator'
import { updatePersonalProfileValidator } from '#validators/update_personal_profile_validator'
import { updatePersonalProfileStatusValidator } from '#validators/update_personal_profile_status_validator'

/**
 * Admin: CRUD hồ sơ cá nhân (personal profiles).
 */
export default class AdminPersonalProfilesController {
  /** Chuẩn hóa profile cho response */
  private serializeProfile(p: PersonalProfile) {
    const dept = p.department
    return {
      id: p.id,
      userId: p.userId,
      staffCode: p.staffCode ?? null,
      fullName: p.fullName,
      gender: p.gender ?? null,
      dateOfBirth: p.dateOfBirth?.toISODate() ?? null,
      placeOfBirth: p.placeOfBirth ?? null,
      phone: p.phone ?? null,
      personalEmail: p.personalEmail ?? null,
      workEmail: p.workEmail ?? null,
      address: p.address ?? null,
      departmentId: p.departmentId ?? null,
      department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
      positionTitle: p.positionTitle ?? null,
      employmentType: p.employmentType ?? null,
      academicDegree: p.academicDegree ?? null,
      academicTitle: p.academicTitle ?? null,
      specialization: p.specialization ?? null,
      professionalQualification: p.professionalQualification ?? null,
      identityNumber: p.identityNumber ?? null,
      identityIssueDate: p.identityIssueDate?.toISODate() ?? null,
      identityIssuePlace: p.identityIssuePlace ?? null,
      status: p.status,
      note: p.note ?? null,
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt?.toISO() ?? null,
    }
  }

  /** GET /api/admin/personal-profiles */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage') ?? request.input('per_page', 10)
    const keyword = request.input('keyword', '')
    const departmentId = request.input('departmentId') ? Number(request.input('departmentId')) : undefined
    const status = request.input('status', '')
    const sortBy = request.input('sortBy', '')
    const order = (request.input('order', 'desc') as 'asc' | 'desc') || 'desc'

    const paginated = await PersonalProfileService.paginate({
      page,
      perPage: Number(perPage),
      keyword: keyword || undefined,
      departmentId,
      status: status || undefined,
      sortBy: sortBy || undefined,
      order,
    })

    const data = paginated.all().map((p) => this.serializeProfile(p))

    return response.ok({
      success: true,
      message: 'Personal profiles fetched successfully',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/admin/personal-profiles/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const profile = await PersonalProfileService.findById(id)
      return response.ok({
        success: true,
        message: 'Personal profile fetched successfully',
        data: this.serializeProfile(profile),
      })
    } catch (err) {
      if ((err as Error).message === 'PERSONAL_PROFILE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ cá nhân.' })
      }
      throw err
    }
  }

  /** GET /api/admin/personal-profiles/user/:userId */
  async showByUserId({ params, response }: HttpContext) {
    const userId = Number(params.userId)
    if (!Number.isFinite(userId)) {
      return response.badRequest({ success: false, message: 'User ID không hợp lệ.' })
    }
    const profile = await PersonalProfileService.findByUserId(userId)
    if (!profile) {
      return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ cá nhân cho user này.' })
    }
    return response.ok({
      success: true,
      message: 'Personal profile fetched successfully',
      data: this.serializeProfile(profile),
    })
  }

  /** POST /api/admin/personal-profiles */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createPersonalProfileValidator)
    try {
      const profile = await PersonalProfileService.create({
        userId: payload.userId,
        staffCode: payload.staffCode ?? null,
        fullName: payload.fullName,
        gender: payload.gender ?? null,
        dateOfBirth: payload.dateOfBirth ?? null,
        placeOfBirth: payload.placeOfBirth ?? null,
        phone: payload.phone ?? null,
        personalEmail: payload.personalEmail ?? null,
        workEmail: payload.workEmail ?? null,
        address: payload.address ?? null,
        departmentId: payload.departmentId ?? null,
        positionTitle: payload.positionTitle ?? null,
        employmentType: payload.employmentType ?? null,
        academicDegree: payload.academicDegree ?? null,
        academicTitle: payload.academicTitle ?? null,
        specialization: payload.specialization ?? null,
        professionalQualification: payload.professionalQualification ?? null,
        identityNumber: payload.identityNumber ?? null,
        identityIssueDate: payload.identityIssueDate ?? null,
        identityIssuePlace: payload.identityIssuePlace ?? null,
        status: (payload.status as any) ?? 'ACTIVE',
        note: payload.note ?? null,
      })
      return response.created({
        success: true,
        message: 'Personal profile created successfully',
        data: this.serializeProfile(profile),
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.unprocessableEntity({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'USER_ALREADY_HAS_PROFILE') {
        return response.unprocessableEntity({
          success: false,
          message: 'User đã có hồ sơ cá nhân.',
        })
      }
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      throw err
    }
  }

  /** PUT /api/admin/personal-profiles/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updatePersonalProfileValidator)
    try {
      const profile = await PersonalProfileService.update(id, {
        staffCode: payload.staffCode,
        fullName: payload.fullName,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth,
        placeOfBirth: payload.placeOfBirth,
        phone: payload.phone,
        personalEmail: payload.personalEmail,
        workEmail: payload.workEmail,
        address: payload.address,
        departmentId: payload.departmentId,
        positionTitle: payload.positionTitle,
        employmentType: payload.employmentType,
        academicDegree: payload.academicDegree,
        academicTitle: payload.academicTitle,
        specialization: payload.specialization,
        professionalQualification: payload.professionalQualification,
        identityNumber: payload.identityNumber,
        identityIssueDate: payload.identityIssueDate,
        identityIssuePlace: payload.identityIssuePlace,
        status: payload.status as any,
        note: payload.note,
      })
      return response.ok({
        success: true,
        message: 'Personal profile updated successfully',
        data: this.serializeProfile(profile),
      })
    } catch (err) {
      if ((err as Error).message === 'PERSONAL_PROFILE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ cá nhân.' })
      }
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      throw err
    }
  }

  /** PATCH /api/admin/personal-profiles/:id/status */
  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updatePersonalProfileStatusValidator)
    try {
      const profile = await PersonalProfileService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Personal profile status updated successfully',
        data: this.serializeProfile(profile),
      })
    } catch (err) {
      if ((err as Error).message === 'PERSONAL_PROFILE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ cá nhân.' })
      }
      throw err
    }
  }
}
