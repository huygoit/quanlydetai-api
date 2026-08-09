import Staff from '#models/staff'
import Department from '#models/department'
import User from '#models/user'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'

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

  static async findByUserId(userId: number): Promise<Staff | null> {
    return Staff.query().where('user_id', userId).first()
  }

  private static parseDate(v: string | null | undefined): DateTime | null {
    if (v == null || v === '') return null
    const d = DateTime.fromISO(String(v).slice(0, 10), { zone: 'local' })
    return d.isValid ? d.startOf('day') : null
  }

  private static normalizeGender(raw: string | null | undefined): string | null {
    if (raw == null || raw === '') return null
    const s = String(raw).trim().toUpperCase()
    if (s === 'MALE' || s === 'FEMALE' || s === 'OTHER') return s
    return s
  }

  /** Gán các field ghi được từ payload form */
  private static async applyWritable(
    staff: Staff,
    payload: Record<string, unknown>,
    opts?: { allowStaffCode?: boolean; allowUserId?: boolean; allowNote?: boolean }
  ) {
    if (opts?.allowStaffCode && payload.staffCode !== undefined) {
      const code = String(payload.staffCode || '').trim()
      if (!code) throw new Error('STAFF_CODE_REQUIRED')
      const clash = await Staff.query().where('staff_code', code).whereNot('id', staff.id || 0).first()
      if (clash) throw new Error('STAFF_CODE_EXISTS')
      staff.staffCode = code
    }
    if (payload.fullName !== undefined) {
      const name = String(payload.fullName || '').trim()
      if (!name) throw new Error('FULL_NAME_REQUIRED')
      staff.fullName = name
    }
    if (payload.gender !== undefined) staff.gender = this.normalizeGender(payload.gender as string | null)
    if (payload.dateOfBirth !== undefined) staff.dateOfBirth = this.parseDate(payload.dateOfBirth as string | null)
    if (payload.placeOfBirth !== undefined) staff.placeOfBirth = (payload.placeOfBirth as string) || null
    if (payload.phone !== undefined) staff.phone = (payload.phone as string) || null
    if (payload.email !== undefined) staff.email = (payload.email as string) || null
    if (payload.currentAddress !== undefined) {
      staff.currentAddress = (payload.currentAddress as string) || null
    }
    if (payload.departmentId !== undefined) {
      const deptId = payload.departmentId == null ? null : Number(payload.departmentId)
      if (deptId != null) {
        const dept = await Department.find(deptId)
        if (!dept) throw new Error('DEPARTMENT_NOT_FOUND')
        staff.departmentId = dept.id
        staff.departmentName = dept.name
        staff.departmentCode = dept.code
      } else {
        staff.departmentId = null
      }
    }
    if (payload.positionTitle !== undefined) staff.positionTitle = (payload.positionTitle as string) || null
    if (payload.staffType !== undefined) staff.staffType = (payload.staffType as string) || null
    if (payload.currentJob !== undefined) staff.currentJob = (payload.currentJob as string) || null
    if (payload.professionalDegree !== undefined) {
      staff.professionalDegree = (payload.professionalDegree as string) || null
    }
    if (payload.academicTitle !== undefined) staff.academicTitle = (payload.academicTitle as string) || null
    if (payload.major !== undefined) staff.major = (payload.major as string) || null
    if (payload.identityNumber !== undefined) staff.identityNumber = (payload.identityNumber as string) || null
    if (payload.identityIssueDate !== undefined) {
      staff.identityIssueDate = this.parseDate(payload.identityIssueDate as string | null)
    }
    if (payload.identityIssuePlace !== undefined) {
      staff.identityIssuePlace = (payload.identityIssuePlace as string) || null
    }
    if (opts?.allowUserId && payload.userId !== undefined) {
      const uid = payload.userId == null ? null : Number(payload.userId)
      if (uid != null) {
        const user = await User.find(uid)
        if (!user) throw new Error('USER_NOT_FOUND')
        const linked = await Staff.query().where('user_id', uid).whereNot('id', staff.id || 0).first()
        if (linked) throw new Error('USER_ALREADY_LINKED')
        staff.userId = uid
      } else {
        staff.userId = null
      }
    }
    if (opts?.allowNote && payload.note !== undefined) staff.note = (payload.note as string) || null
  }

  static async create(payload: Record<string, unknown>): Promise<Staff> {
    const code = String(payload.staffCode || '').trim()
    const name = String(payload.fullName || '').trim()
    if (!code) throw new Error('STAFF_CODE_REQUIRED')
    if (!name) throw new Error('FULL_NAME_REQUIRED')
    const exists = await Staff.query().where('staff_code', code).first()
    if (exists) throw new Error('STAFF_CODE_EXISTS')

    const staff = new Staff()
    staff.staffCode = code
    staff.fullName = name
    await this.applyWritable(staff, payload, {
      allowStaffCode: false,
      allowUserId: true,
      allowNote: true,
    })
    await staff.save()
    return staff
  }

  static async update(id: number, payload: Record<string, unknown>): Promise<Staff> {
    const staff = await Staff.find(id)
    if (!staff) throw new Error('STAFF_NOT_FOUND')
    await this.applyWritable(staff, payload, {
      allowStaffCode: true,
      allowUserId: true,
      allowNote: true,
    })
    await staff.save()
    return staff
  }

  /** Cán bộ tự cập nhật hồ sơ gắn user_id */
  static async updateOwn(userId: number, payload: Record<string, unknown>): Promise<Staff> {
    const staff = await this.findByUserId(userId)
    if (!staff) throw new Error('STAFF_NOT_FOUND')
    await this.applyWritable(staff, payload, {
      allowStaffCode: false,
      allowUserId: false,
      allowNote: false,
    })
    await staff.save()
    return staff
  }
}
