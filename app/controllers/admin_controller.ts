import type { HttpContext } from '@adonisjs/core/http'
import SystemConfig from '#models/system_config'
import AuditLog from '#models/audit_log'
import { updateConfigValidator } from '#validators/config_validator'

/**
 * Controller quản trị: configs và audit-logs (chỉ ADMIN).
 */
export default class AdminController {
  // --- System Configs

  /**
   * GET /api/admin/configs
   */
  async configsIndex({ response }: HttpContext) {
    const list = await SystemConfig.query().orderBy('key', 'asc')
    const data = list.map((c) => ({
      key: c.key,
      value: c.value,
      description: c.description,
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/admin/configs/:key
   */
  async configsShow({ params, response }: HttpContext) {
    const config = await SystemConfig.findBy('key', params.key)
    if (!config) {
      return response.notFound({ success: false, message: 'Không tìm thấy cấu hình.' })
    }
    return response.ok({
      success: true,
      data: { key: config.key, value: config.value, description: config.description },
    })
  }

  /**
   * PUT /api/admin/configs/:key
   */
  async configsUpdate({ params, request, response }: HttpContext) {
    const config = await SystemConfig.findBy('key', params.key)
    if (!config) {
      return response.notFound({ success: false, message: 'Không tìm thấy cấu hình.' })
    }
    const payload = await request.validateUsing(updateConfigValidator)
    if (payload.value !== undefined) config.value = payload.value
    if (payload.description !== undefined) config.description = payload.description
    await config.save()
    return response.ok({
      success: true,
      data: { key: config.key, value: config.value, description: config.description },
    })
  }

  // --- Audit Logs

  /**
   * GET /api/admin/audit-logs
   * Query: userId, action, entityType, startDate, endDate, page, perPage
   */
  async auditLogsIndex({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 20), 100)
    const userId = request.input('userId', '')
    const action = request.input('action', '')
    const entityType = request.input('entityType', '')
    const startDate = request.input('startDate', '')
    const endDate = request.input('endDate', '')

    const q = AuditLog.query().orderBy('created_at', 'desc')

    if (userId) q.where('user_id', userId)
    if (action) q.where('action', action)
    if (entityType) q.where('entity_type', entityType)
    if (startDate) q.where('created_at', '>=', startDate)
    if (endDate) q.where('created_at', '<=', endDate)

    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldData: log.oldData,
      newData: log.newData,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISO(),
    }))
    return response.ok({
      success: true,
      data,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
    })
  }
}
