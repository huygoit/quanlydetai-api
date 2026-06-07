import ScientificProfile from '#models/scientific_profile'
import Role from '#models/role'
import UserRoleAssignment from '#models/user_role_assignment'
import PermissionService from '#services/permission_service'

/** Role tài khoản vận hành — không dùng làm tác giả khoa học. */
export const ADMIN_KE_KHAI_ROLE_CODES = ['ADMIN', 'SUPER_ADMIN'] as const

export default class ScientificProfileAdminService {
  static isAdminKeKhaiRoleCode(code: string | null | undefined): boolean {
    if (!code) return false
    return (ADMIN_KE_KHAI_ROLE_CODES as readonly string[]).includes(code)
  }

  static async userHasAdminKeKhaiRole(userId: number): Promise<boolean> {
    const roles = await PermissionService.getUserRoles(userId)
    return roles.some((c) => this.isAdminKeKhaiRoleCode(c))
  }

  static async isAdminScientificProfile(profileId: number): Promise<boolean> {
    const profile = await ScientificProfile.find(profileId)
    if (!profile) return false
    return this.userHasAdminKeKhaiRole(profile.userId)
  }

  /** user_id có role ADMIN/SUPER_ADMIN (assignment active). */
  static async getUserIdsWithAdminKeKhaiRole(): Promise<number[]> {
    const roles = await Role.query()
      .whereIn('code', [...ADMIN_KE_KHAI_ROLE_CODES])
      .where('status', 'ACTIVE')
    const roleIds = roles.map((r) => r.id)
    if (roleIds.length === 0) return []

    const assignments = await UserRoleAssignment.query()
      .whereIn('role_id', roleIds)
      .where('is_active', true)
      .select('user_id')
    return [...new Set(assignments.map((a) => a.userId))]
  }

  /** Trong danh sách profile_id, trả subset thuộc tài khoản admin. */
  static async adminProfileIdsAmong(profileIds: number[]): Promise<Set<number>> {
    const ids = [...new Set(profileIds.filter((id) => Number.isFinite(id) && id > 0))]
    const out = new Set<number>()
    if (ids.length === 0) return out

    const profiles = await ScientificProfile.query().whereIn('id', ids).select('id', 'user_id')
    for (const p of profiles) {
      if (await this.userHasAdminKeKhaiRole(p.userId)) {
        out.add(p.id)
      }
    }
    return out
  }

  static resolvedProfileIdFromAuthorRow(row: {
    profile_id?: number | null
    profileId?: number | null
  }): number | null {
    const raw = row.profile_id !== undefined ? row.profile_id : row.profileId
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  /** Loại dòng tác giả gắn hồ sơ admin khỏi payload trước khi lưu. */
  static async stripAdminProfilesFromAuthorRows<
    T extends { profile_id?: number | null; profileId?: number | null },
  >(authors: T[]): Promise<T[]> {
    const profileIds = authors
      .map((a) => this.resolvedProfileIdFromAuthorRow(a))
      .filter((id): id is number => id != null)
    const adminIds = await this.adminProfileIdsAmong(profileIds)
    if (adminIds.size === 0) return authors
    return authors.filter((a) => {
      const pid = this.resolvedProfileIdFromAuthorRow(a)
      return pid == null || !adminIds.has(pid)
    })
  }
}
