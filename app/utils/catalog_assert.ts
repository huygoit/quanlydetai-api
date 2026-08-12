import Catalog from '#models/catalog'
import Field from '#models/field'
import ProjectProcessType from '#models/project_process_type'

/**
 * Kiểm tra tên lĩnh vực có trong danh mục fields (ACTIVE).
 */
export async function isActiveFieldName(name: string): Promise<boolean> {
  const ten = String(name || '').trim()
  if (!ten) return false
  const row = await Field.query().where('status', 'ACTIVE').where('name', ten).first()
  return !!row
}

/**
 * Kiểm tra mã cấp thuộc catalogs type (IDEA_LEVEL | PROJECT_LEVEL) đang active.
 */
export async function areActiveCatalogCodes(type: string, codes: string[]): Promise<boolean> {
  const list = [...new Set(codes.map((c) => String(c || '').trim()).filter(Boolean))]
  if (list.length === 0) return false
  const rows = await Catalog.query()
    .where('type', type)
    .where('is_active', true)
    .whereIn('code', list)
  return rows.length === list.length
}

/**
 * Kiểm tra mã cấp thuộc danh mục Cấp ý tưởng/đề tài (project_process_types ACTIVE).
 */
export async function areActiveProcessTypeCodes(codes: string[]): Promise<boolean> {
  const list = [...new Set(codes.map((c) => String(c || '').trim()).filter(Boolean))]
  if (list.length === 0) return false
  const rows = await ProjectProcessType.query().where('status', 'ACTIVE').whereIn('code', list)
  return rows.length === list.length
}
