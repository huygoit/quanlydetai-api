import PersonalProfile from '#models/personal_profile'
import User from '#models/user'
import Department from '#models/department'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { PersonalProfileStatus } from '#models/personal_profile'
import { DateTime } from 'luxon'

export interface PersonalProfileFilters {
  page?: number
  perPage?: number
  keyword?: string
  staffCode?: string
  departmentId?: number
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface CreatePersonalProfilePayload {
  userId: number
  staffCode?: string | null
  fullName: string
  gender?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  phone?: string | null
  personalEmail?: string | null
  workEmail?: string | null
  address?: string | null
  departmentId?: number | null
  positionTitle?: string | null
  employmentType?: string | null
  academicDegree?: string | null
  academicTitle?: string | null
  specialization?: string | null
  professionalQualification?: string | null
  identityNumber?: string | null
  identityIssueDate?: string | null
  identityIssuePlace?: string | null
  status?: PersonalProfileStatus
  note?: string | null
}

export interface UpdatePersonalProfilePayload {
  staffCode?: string | null
  fullName?: string
  gender?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  phone?: string | null
  personalEmail?: string | null
  workEmail?: string | null
  address?: string | null
  departmentId?: number | null
  positionTitle?: string | null
  employmentType?: string | null
  academicDegree?: string | null
  academicTitle?: string | null
  specialization?: string | null
  professionalQualification?: string | null
  identityNumber?: string | null
  identityIssueDate?: string | null
  identityIssuePlace?: string | null
  status?: PersonalProfileStatus
  note?: string | null
}

/** Parse chuỗi date thành DateTime hoặc null */
function parseDate(v: string | null | undefined): DateTime | null {
  if (v == null || v === '') return null
  const d = DateTime.fromISO(v)
  return d.isValid ? d : null
}

/**
 * Service quản lý hồ sơ cá nhân.
 */
export default class PersonalProfileService {
  static async paginate(
    filters: PersonalProfileFilters = {}
  ): Promise<ModelPaginatorContract<PersonalProfile>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 10, 100)
    const sortBy = filters.sortBy ?? 'updated_at'
    const order = filters.order ?? 'desc'

    const q = PersonalProfile.query()
      .preload('user', (u) => u.select('id', 'full_name', 'email'))
      .preload('department', (d) => d.select('id', 'name', 'code'))

    const kw = filters.keyword?.trim()
    if (kw) {
      q.where((b) => {
        b.whereILike('full_name', `%${kw}%`)
          .orWhereILike('staff_code', `%${kw}%`)
          .orWhereILike('phone', `%${kw}%`)
          .orWhereILike('personal_email', `%${kw}%`)
          .orWhereILike('work_email', `%${kw}%`)
      })
    }
    const staffCode = filters.staffCode?.trim()
    if (staffCode) {
      const normalizedStaffCode = staffCode.replace(/[^0-9a-zA-Z]/g, '')
      q.where((b) => {
        b.whereILike('staff_code', `%${staffCode}%`)
        if (normalizedStaffCode) {
          b.orWhereRaw(
            "regexp_replace(coalesce(staff_code, ''), '[^0-9a-zA-Z]', '', 'g') ILIKE ?",
            [`%${normalizedStaffCode}%`]
          )
        }
      })
    }
    if (filters.departmentId != null) q.where('department_id', filters.departmentId)
    if (filters.status) q.where('status', filters.status)

    const validSort = ['id', 'full_name', 'staff_code', 'status', 'updated_at', 'created_at']
    const col = validSort.includes(sortBy) ? sortBy : 'updated_at'
    q.orderBy(col, order === 'desc' ? 'desc' : 'asc')

    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<PersonalProfile> {
    const p = await PersonalProfile.query()
      .where('id', id)
      .preload('user', (u) => u.select('id', 'full_name', 'email', 'phone'))
      .preload('department', (d) => d.select('id', 'name', 'code'))
      .first()
    if (!p) throw new Error('PERSONAL_PROFILE_NOT_FOUND')
    return p
  }

  static async findByUserId(userId: number): Promise<PersonalProfile | null> {
    return PersonalProfile.query()
      .where('user_id', userId)
      .preload('user', (u) => u.select('id', 'full_name', 'email', 'phone'))
      .preload('department', (d) => d.select('id', 'name', 'code'))
      .first()
  }

  static async create(payload: CreatePersonalProfilePayload): Promise<PersonalProfile> {
    const user = await User.find(payload.userId)
    if (!user) throw new Error('USER_NOT_FOUND')

    const existing = await PersonalProfile.query().where('user_id', payload.userId).first()
    if (existing) throw new Error('USER_ALREADY_HAS_PROFILE')

    if (payload.departmentId != null) {
      const dept = await Department.find(payload.departmentId)
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND')
    }

    const profile = await PersonalProfile.create({
      userId: payload.userId,
      staffCode: payload.staffCode ?? null,
      fullName: payload.fullName,
      gender: (payload.gender as any) ?? null,
      dateOfBirth: parseDate(payload.dateOfBirth),
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
      identityIssueDate: parseDate(payload.identityIssueDate),
      identityIssuePlace: payload.identityIssuePlace ?? null,
      status: payload.status ?? 'ACTIVE',
      note: payload.note ?? null,
    })
    return this.findById(profile.id)
  }

  static async update(id: number, payload: UpdatePersonalProfilePayload): Promise<PersonalProfile> {
    const profile = await this.findById(id)

    if (payload.departmentId !== undefined && payload.departmentId != null) {
      const dept = await Department.find(payload.departmentId)
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND')
    }

    if (payload.staffCode !== undefined) profile.staffCode = payload.staffCode ?? null
    if (payload.fullName !== undefined) profile.fullName = payload.fullName
    if (payload.gender !== undefined) profile.gender = payload.gender as any ?? null
    if (payload.dateOfBirth !== undefined) profile.dateOfBirth = parseDate(payload.dateOfBirth)
    if (payload.placeOfBirth !== undefined) profile.placeOfBirth = payload.placeOfBirth ?? null
    if (payload.phone !== undefined) profile.phone = payload.phone ?? null
    if (payload.personalEmail !== undefined) profile.personalEmail = payload.personalEmail ?? null
    if (payload.workEmail !== undefined) profile.workEmail = payload.workEmail ?? null
    if (payload.address !== undefined) profile.address = payload.address ?? null
    if (payload.departmentId !== undefined) profile.departmentId = payload.departmentId ?? null
    if (payload.positionTitle !== undefined) profile.positionTitle = payload.positionTitle ?? null
    if (payload.employmentType !== undefined) profile.employmentType = payload.employmentType ?? null
    if (payload.academicDegree !== undefined) profile.academicDegree = payload.academicDegree ?? null
    if (payload.academicTitle !== undefined) profile.academicTitle = payload.academicTitle ?? null
    if (payload.specialization !== undefined) profile.specialization = payload.specialization ?? null
    if (payload.professionalQualification !== undefined)
      profile.professionalQualification = payload.professionalQualification ?? null
    if (payload.identityNumber !== undefined) profile.identityNumber = payload.identityNumber ?? null
    if (payload.identityIssueDate !== undefined)
      profile.identityIssueDate = parseDate(payload.identityIssueDate)
    if (payload.identityIssuePlace !== undefined)
      profile.identityIssuePlace = payload.identityIssuePlace ?? null
    if (payload.status !== undefined) profile.status = payload.status
    if (payload.note !== undefined) profile.note = payload.note ?? null

    await profile.save()
    return this.findById(id)
  }

  static async updateStatus(
    id: number,
    status: PersonalProfileStatus
  ): Promise<PersonalProfile> {
    const profile = await this.findById(id)
    profile.status = status
    await profile.save()
    return this.findById(id)
  }
}
