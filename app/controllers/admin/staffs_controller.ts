import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Staff from '#models/staff'
import StaffService from '#services/staff_service'

/**
 * Admin: danh sách & chi tiết nhân sự (bảng staffs).
 */
export default class AdminStaffsController {
  /** Bản ghi rút gọn cho danh sách — đủ chọn GVHD / tìm kiếm nhanh */
  private serializeStaffSummary(s: Staff) {
    return {
      id: s.id,
      staffCode: s.staffCode,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone,
      departmentId: s.departmentId,
      departmentCode: s.departmentCode,
      departmentName: s.departmentName,
      staffType: s.staffType,
      positionTitle: s.positionTitle,
      currentJob: s.currentJob,
      userId: s.userId,
      createdAt: s.createdAt.toISO(),
      updatedAt: s.updatedAt?.toISO() ?? null,
    }
  }

  private isoDate(d: DateTime | null): string | null {
    return d ? d.toISODate() : null
  }

  private isoDateTime(d: DateTime | null): string | null {
    return d ? d.toISO() : null
  }

  /** Chi tiết đầy đủ (trừ sourceData trừ khi client yêu cầu) */
  private serializeStaffDetail(s: Staff, includeSourceData: boolean) {
    const base = {
      id: s.id,
      staffCode: s.staffCode,
      fullName: s.fullName,
      dateOfBirth: this.isoDate(s.dateOfBirth),
      gender: s.gender,
      maritalStatus: s.maritalStatus,
      religionOrEthnicity: s.religionOrEthnicity,
      priorityGroup: s.priorityGroup,
      identityNumber: s.identityNumber,
      identityIssuePlace: s.identityIssuePlace,
      identityIssueDate: this.isoDate(s.identityIssueDate),
      insuranceNumber: s.insuranceNumber,
      hometown: s.hometown,
      placeOfBirth: s.placeOfBirth,
      permanentAddress: s.permanentAddress,
      currentAddress: s.currentAddress,
      phone: s.phone,
      email: s.email,
      departmentId: s.departmentId,
      departmentCode: s.departmentCode,
      departmentName: s.departmentName,
      hiredAt: this.isoDate(s.hiredAt),
      rankedAt: this.isoDate(s.rankedAt),
      receivingAgency: s.receivingAgency,
      recruitmentWorkType: s.recruitmentWorkType,
      staffType: s.staffType,
      currentJob: s.currentJob,
      socialInsuranceLeave: s.socialInsuranceLeave,
      positionTitle: s.positionTitle,
      appointedAt: this.isoDate(s.appointedAt),
      concurrentPosition: s.concurrentPosition,
      highestPosition: s.highestPosition,
      partyJoinedAtRaw: s.partyJoinedAtRaw,
      partyPosition: s.partyPosition,
      isUnionMember: s.isUnionMember,
      professionalDegree: s.professionalDegree,
      industryGroup: s.industryGroup,
      field: s.field,
      major: s.major,
      professionalTitle: s.professionalTitle,
      trainingPlace: s.trainingPlace,
      trainingMode: s.trainingMode,
      trainingCountry: s.trainingCountry,
      trainingInstitution: s.trainingInstitution,
      graduationYear: s.graduationYear,
      politicalLevel: s.politicalLevel,
      stateManagementLevel: s.stateManagementLevel,
      itLevel: s.itLevel,
      titleAward: s.titleAward,
      recognitionYear: s.recognitionYear,
      academicTitle: s.academicTitle,
      is85Program: s.is85Program,
      jobTitleType: s.jobTitleType,
      salaryStep: s.salaryStep,
      salaryCoefficient: s.salaryCoefficient,
      userId: s.userId,
      note: s.note,
      createdAt: this.isoDateTime(s.createdAt),
      updatedAt: this.isoDateTime(s.updatedAt),
    }
    if (includeSourceData) {
      return { ...base, sourceData: s.sourceData }
    }
    return base
  }

  /**
   * GET /api/admin/staffs
   * Query: page, perPage, keyword, departmentId, departmentCode, staffType, hasUser (true|false), sortBy, order
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 20)
    const keyword = request.input('keyword', '')
    const departmentIdRaw = request.input('departmentId', '')
    const departmentCode = request.input('departmentCode', '')
    const staffType = request.input('staffType', '')
    const hasUserRaw = request.input('hasUser', '')
    const sortBy = request.input('sortBy', '')
    const order = request.input('order', 'asc')

    let hasUser: boolean | undefined
    if (hasUserRaw === 'true' || hasUserRaw === '1') hasUser = true
    else if (hasUserRaw === 'false' || hasUserRaw === '0') hasUser = false

    const departmentId =
      departmentIdRaw !== '' && departmentIdRaw != null ? Number(departmentIdRaw) : undefined

    const paginated = await StaffService.paginate({
      page: Number(page) || 1,
      perPage: Number(perPage) || 20,
      keyword: keyword || undefined,
      departmentId: Number.isFinite(departmentId) ? departmentId : undefined,
      departmentCode: departmentCode || undefined,
      staffType: staffType || undefined,
      hasUser,
      sortBy: sortBy || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    })

    const data = paginated.all().map((s) => this.serializeStaffSummary(s))

    return response.ok({
      message: 'Danh sách nhân sự',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/admin/staffs/:id — ?includeSourceData=1 để trả thêm source_data (json Excel) */
  async show({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const staff = await StaffService.findById(id)
    if (!staff) {
      return response.notFound({ success: false, message: 'Không tìm thấy nhân sự.' })
    }

    const includeSource =
      request.input('includeSourceData') === '1' ||
      request.input('includeSourceData') === 'true'

    return response.ok({
      message: 'Chi tiết nhân sự',
      data: this.serializeStaffDetail(staff, includeSource),
    })
  }
}
