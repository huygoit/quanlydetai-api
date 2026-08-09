import User from '#models/user'
import Department from '#models/department'

/**
 * Nhãn đơn vị để hiển thị (owner_unit trên đề xuất).
 * Không dùng để phân quyền — phân quyền Khoa chỉ theo department_id.
 */
export async function resolveUserUnitLabel(
  user: Pick<User, 'unit' | 'departmentId'> & { department?: Department | null }
): Promise<string> {
  if (user.department?.name) return String(user.department.name).trim()
  if (user.departmentId != null) {
    const dept = await Department.find(user.departmentId)
    if (dept?.name) return String(dept.name).trim()
  }
  return String(user.unit ?? '').trim()
}

/** Cùng đơn vị theo department_id (phân quyền Khoa). */
export function sameDepartmentId(
  a: number | string | null | undefined,
  b: number | string | null | undefined
): boolean {
  if (a == null || b == null || a === '' || b === '') return false
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}
