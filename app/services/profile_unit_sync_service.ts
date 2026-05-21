import Department from '#models/department'
import {
  getUdnAffiliationUnitLabel,
  isUdnAffiliationUnitKey,
  resolveUdnAffiliationUnitKey,
  type UdnAffiliationUnitKey,
} from '#constants/udn_affiliation_units'
import { mapFacultyText } from '#services/scientific_profile_unit_mapper_service'

export type ResolvedOrganizationFields = {
  organization: string
  organizationId: UdnAffiliationUnitKey | null
}

export type ResolvedDepartmentFields = {
  faculty: string | null
  departmentId: number | null
}

/**
 * Chuẩn hóa organization + organization_id từ payload FE.
 */
export function resolveOrganizationFields(input: {
  organization?: string
  organizationId?: string | null
}): ResolvedOrganizationFields {
  const orgIdRaw = input.organizationId != null ? String(input.organizationId).trim() : ''
  const orgTextRaw = input.organization != null ? String(input.organization).trim() : ''

  if (orgIdRaw) {
    if (!isUdnAffiliationUnitKey(orgIdRaw) || orgIdRaw === 'OTHER') {
      throw new Error('INVALID_ORGANIZATION_ID')
    }
    const label = getUdnAffiliationUnitLabel(orgIdRaw)
    return {
      organizationId: orgIdRaw,
      organization: label ?? orgTextRaw,
    }
  }

  if (orgTextRaw) {
    const key = resolveUdnAffiliationUnitKey(orgTextRaw)
    return {
      organizationId: key,
      organization: key ? (getUdnAffiliationUnitLabel(key) ?? orgTextRaw) : orgTextRaw,
    }
  }

  throw new Error('ORGANIZATION_REQUIRED')
}

/**
 * Chuẩn hóa faculty + department_id từ payload FE.
 */
export async function resolveDepartmentFields(input: {
  faculty?: string | null
  departmentId?: number | null
}): Promise<ResolvedDepartmentFields> {
  const deptId = input.departmentId
  if (deptId != null && Number.isFinite(Number(deptId))) {
    const dept = await Department.query()
      .where('id', Number(deptId))
      .where('status', 'ACTIVE')
      .first()
    if (!dept) {
      throw new Error('INVALID_DEPARTMENT_ID')
    }
    return {
      departmentId: dept.id,
      faculty: dept.name,
    }
  }

  const facultyText = input.faculty != null ? String(input.faculty).trim() : ''
  if (!facultyText) {
    return { departmentId: null, faculty: null }
  }

  const mapped = await mapFacultyText(facultyText)
  return {
    departmentId: mapped.departmentId,
    faculty: mapped.faculty,
  }
}
