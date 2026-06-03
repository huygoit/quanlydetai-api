import type { HttpContext } from '@adonisjs/core/http'
import type PersonalProfile from '#models/personal_profile'
import PersonalProfileService from '#services/personal_profile_service'
import { updateOwnPersonalProfileValidator } from '#validators/update_own_personal_profile_validator'

/**
 * Hồ sơ cá nhân của user đang đăng nhập (xem + tự sửa).
 */
export default class MePersonalProfileController {
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

  /** GET /api/me/personal-profile */
  async show({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await PersonalProfileService.findByUserId(user.id)
    if (!profile) {
      return response.notFound({
        success: false,
        message: 'Chưa có hồ sơ cá nhân. Vui lòng liên hệ quản trị để được tạo hồ sơ.',
      })
    }
    return response.ok({
      success: true,
      message: 'Personal profile fetched successfully',
      data: this.serializeProfile(profile),
    })
  }

  /** PUT /api/me/personal-profile */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await PersonalProfileService.findByUserId(user.id)
    if (!profile) {
      return response.notFound({
        success: false,
        message: 'Chưa có hồ sơ cá nhân. Vui lòng liên hệ quản trị để được tạo hồ sơ.',
      })
    }

    const payload = await request.validateUsing(updateOwnPersonalProfileValidator)
    try {
      const updated = await PersonalProfileService.update(profile.id, payload)
      return response.ok({
        success: true,
        message: 'Cập nhật hồ sơ cá nhân thành công',
        data: this.serializeProfile(updated),
      })
    } catch (e) {
      const code = (e as Error).message
      if (code === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({
          success: false,
          message: 'Đơn vị không hợp lệ.',
        })
      }
      throw e
    }
  }
}
