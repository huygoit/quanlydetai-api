import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Staff from '#models/staff'
import StaffService from '#services/staff_service'
import { updateOwnStaffValidator } from '#validators/staff_write_validator'

/**
 * Hồ sơ cán bộ của tôi — đọc/ghi bảng staffs theo user đăng nhập.
 */
export default class MeStaffProfileController {
  private isoDate(d: DateTime | null): string | null {
    return d ? d.toISODate() : null
  }

  private serialize(s: Staff) {
    return {
      id: Number(s.id),
      staffCode: s.staffCode,
      fullName: s.fullName,
      gender: s.gender,
      dateOfBirth: this.isoDate(s.dateOfBirth),
      placeOfBirth: s.placeOfBirth,
      phone: s.phone,
      email: s.email,
      currentAddress: s.currentAddress,
      departmentId: s.departmentId,
      departmentName: s.departmentName,
      departmentCode: s.departmentCode,
      positionTitle: s.positionTitle,
      concurrentPosition: s.concurrentPosition,
      highestPosition: s.highestPosition,
      partyPosition: s.partyPosition,
      staffType: s.staffType,
      currentJob: s.currentJob,
      professionalDegree: s.professionalDegree,
      academicTitle: s.academicTitle,
      major: s.major,
      identityNumber: s.identityNumber,
      identityIssueDate: this.isoDate(s.identityIssueDate),
      identityIssuePlace: s.identityIssuePlace,
      userId: s.userId != null ? Number(s.userId) : null,
      note: s.note,
    }
  }

  /** GET /api/me/staff-profile */
  async show({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const staff = await StaffService.findByUserId(user.id)
    if (!staff) {
      return response.notFound({
        success: false,
        message: 'Chưa có hồ sơ nhân sự gắn tài khoản. Vui lòng liên hệ quản trị.',
      })
    }
    return response.ok({
      success: true,
      message: 'Staff profile fetched successfully',
      data: this.serialize(staff),
    })
  }

  /** PUT /api/me/staff-profile */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(updateOwnStaffValidator)
    try {
      const staff = await StaffService.updateOwn(user.id, payload as Record<string, unknown>)
      return response.ok({
        success: true,
        message: 'Cập nhật hồ sơ nhân sự thành công',
        data: this.serialize(staff),
      })
    } catch (e) {
      const code = (e as Error).message
      if (code === 'STAFF_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Chưa có hồ sơ nhân sự gắn tài khoản.',
        })
      }
      if (code === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({ success: false, message: 'Đơn vị không hợp lệ.' })
      }
      throw e
    }
  }
}
