import Staff from '#models/staff'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

/** Tham số lọc danh sách nhân sự (staffs) */
export interface StaffListFilters {
  page?: number
  perPage?: number
  /** Tìm theo họ tên, mã NV, email, SĐT, tên đơn vị (chứa, không phân biệt hoa thường) */
  keyword?: string
  /** Tìm trực tiếp theo mã nhân viên */
  staffCode?: string
  /** Lọc theo id bảng departments */
  departmentId?: number
  /** Lọc theo mã đơn vị (chứa) */
  departmentCode?: string
  /** Lọc theo loại cán bộ (nv_loaicanbo — chứa) */
  staffType?: string
  /** true = đã liên kết user; false = chưa liên kết; bỏ qua = tất cả */
  hasUser?: boolean
  sortBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Đọc danh mục nhân sự (staffs) — phân trang và lọc.
 */
export default class StaffService {
  static async paginate(filters: StaffListFilters = {}): Promise<ModelPaginatorContract<Staff>> {
    const page = Math.max(1, Number(filters.page) || 1)
    const perPage = Math.min(Math.max(1, Number(filters.perPage) || 20), 100)
    const order = filters.order === 'desc' ? 'desc' : 'asc'

    const validSort = ['id', 'fullName', 'staffCode', 'departmentName', 'createdAt', 'staffType', 'email']
    const sortBy = filters.sortBy || 'fullName'
    const sortCol = validSort.includes(sortBy) ? sortBy : 'fullName'

    const q = Staff.query()

    const kw = filters.keyword?.trim()
    if (kw) {
      const like = `%${kw}%`
      const normalizedKw = kw.replace(/[^0-9a-zA-Z]/g, '')
      q.where((b) => {
        b.whereILike('fullName', like)
          .orWhereILike('staffCode', like)
          .orWhereILike('email', like)
          .orWhereILike('phone', like)
          .orWhereILike('departmentName', like)
        if (normalizedKw) {
          b.orWhereRaw(
            "regexp_replace(coalesce(staff_code, ''), '[^0-9a-zA-Z]', '', 'g') ILIKE ?",
            [`%${normalizedKw}%`]
          )
        }
      })
    }

    const staffCode = filters.staffCode?.trim()
    if (staffCode) {
      const staffCodeLike = `%${staffCode}%`
      const normalizedStaffCode = staffCode.replace(/[^0-9a-zA-Z]/g, '')
      q.where((b) => {
        b.whereILike('staffCode', staffCodeLike)
        if (normalizedStaffCode) {
          b.orWhereRaw(
            "regexp_replace(coalesce(staff_code, ''), '[^0-9a-zA-Z]', '', 'g') ILIKE ?",
            [`%${normalizedStaffCode}%`]
          )
        }
      })
    }

    if (filters.departmentId != null && Number.isFinite(Number(filters.departmentId))) {
      q.where('departmentId', Number(filters.departmentId))
    }

    const dc = filters.departmentCode?.trim()
    if (dc) {
      q.whereILike('departmentCode', `%${dc}%`)
    }

    const st = filters.staffType?.trim()
    if (st) {
      q.whereILike('staffType', `%${st}%`)
    }

    if (filters.hasUser === true) {
      q.whereNotNull('userId')
    } else if (filters.hasUser === false) {
      q.whereNull('userId')
    }

    q.orderBy(sortCol, order)
    if (sortCol !== 'id') {
      q.orderBy('id', 'asc')
    }

    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<Staff | null> {
    return Staff.find(id)
  }
}
