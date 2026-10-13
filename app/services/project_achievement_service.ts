import db from '@adonisjs/lucid/services/db'
import { hasPerm } from '#services/module56_common'

type BoLoc = {
  year?: number | null
  userId?: number | null
  departmentId?: number | null
}

/**
 * Danh sách nhiệm vụ đã hoàn thành, đọc từ nhiệm vụ chứ không từ hồ sơ khoa học.
 * Người chưa có hồ sơ vẫn xuất hiện nếu là chủ nhiệm hoặc thành viên.
 */
export default class ProjectAchievementService {
  static async list(actorId: number, filter: BoLoc) {
    const xemTatCa =
      (await hasPerm(actorId, 'project.view')) || (await hasPerm(actorId, 'project.review'))
    const userId = xemTatCa ? filter.userId || null : actorId
    const year = filter.year && Number.isFinite(filter.year) ? Number(filter.year) : null
    const departmentId =
      filter.departmentId && Number.isFinite(filter.departmentId) ? Number(filter.departmentId) : null

    const q = db
      .from('project_outlines as o')
      .leftJoin('project_final_cases as f', 'f.project_outline_id', 'o.id')
      .leftJoin('users as u', 'u.id', 'o.owner_id')
      .where('o.execution_status', 'HOAN_THANH')
      .select(
        'o.id',
        'o.code',
        'o.title',
        'o.owner_id',
        'o.owner_name',
        'o.owner_unit',
        'o.approved_budget',
        'f.classification',
        'f.liq_cnnv_signed_at'
      )
      .orderBy('f.liq_cnnv_signed_at', 'desc')
      .limit(500)

    if (year) q.whereRaw('EXTRACT(YEAR FROM f.liq_cnnv_signed_at) = ?', [year])
    if (departmentId) {
      q.where((b) => {
        b.where('u.department_id', departmentId).orWhereExists((sub) => {
          sub
            .from('project_outline_members as m')
            .whereRaw('m.project_outline_id = o.id')
            .where('m.department_id', departmentId)
        })
      })
    }
    if (userId) {
      q.where((b) => {
        b.where('o.owner_id', userId).orWhereExists((sub) => {
          sub
            .from('project_outline_members as m')
            .join('scientific_profiles as sp', 'sp.id', 'm.profile_id')
            .whereRaw('m.project_outline_id = o.id')
            .where('sp.user_id', userId)
        })
      })
    }

    const rows = await q
    const ids = rows.map((r) => Number(r.id))
    const members = ids.length
      ? await db
          .from('project_outline_members')
          .whereIn('project_outline_id', ids)
          .select('project_outline_id', 'full_name', 'role', 'profile_id', 'department_id')
      : []

    return rows.map((row) => {
      const thanhVien = members
        .filter((m) => Number(m.project_outline_id) === Number(row.id))
        .map((m) => ({
          fullName: m.full_name,
          role: m.role,
          profileId: m.profile_id,
          departmentId: m.department_id,
        }))
      return {
        outlineId: Number(row.id),
        code: row.code,
        title: row.title,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        ownerUnit: row.owner_unit,
        budget: row.approved_budget == null ? null : Number(row.approved_budget),
        classification: row.classification,
        completedAt: row.liq_cnnv_signed_at,
        members: thanhVien,
      }
    })
  }
}
