import type { HttpContext } from '@adonisjs/core/http'
import SchoolOrgProfileService from '#services/school_org_profile_service'
import PermissionService from '#services/permission_service'

/**
 * Cấu hình profile trường (Bên A) — singleton.
 */
export default class AdminSchoolOrgProfilesController {
  private async canView(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'org_profile.view')) ||
      (await PermissionService.userHasPermission(userId, 'org_profile.update')) ||
      (await PermissionService.userHasPermission(userId, 'contract_template.view'))
    )
  }

  private async canUpdate(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'org_profile.update')) ||
      (await PermissionService.userHasPermission(userId, 'contract_template.update'))
    )
  }

  async show({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền xem profile trường.' })
    }
    const data = await SchoolOrgProfileService.get()
    return response.ok({
      success: true,
      data: {
        ...data,
        mergePreview: SchoolOrgProfileService.toBm06Vars(data),
      },
    })
  }

  async update({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canUpdate(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền cập nhật profile trường.' })
    }
    const body = request.body() || {}
    const data = await SchoolOrgProfileService.update({
      logoUrl: body.logoUrl ?? body.logo_url,
      schoolName: body.schoolName ?? body.school_name,
      universitySystem: body.universitySystem ?? body.university_system,
      daiDienBenA: body.daiDienBenA ?? body.dai_dien_ben_a,
      chucVuBenA: body.chucVuBenA ?? body.chuc_vu_ben_a,
      diaChiBenA: body.diaChiBenA ?? body.dia_chi_ben_a,
      dienThoaiBenA: body.dienThoaiBenA ?? body.dien_thoai_ben_a,
      emailBenA: body.emailBenA ?? body.email_ben_a,
      taiKhoanBenA: body.taiKhoanBenA ?? body.tai_khoan_ben_a,
      nganHangBenA: body.nganHangBenA ?? body.ngan_hang_ben_a,
      maSoThueBenA: body.maSoThueBenA ?? body.ma_so_thue_ben_a,
    })
    return response.ok({
      success: true,
      message: 'Đã lưu cấu hình profile trường.',
      data: {
        ...data,
        mergePreview: SchoolOrgProfileService.toBm06Vars(data),
      },
    })
  }
}
