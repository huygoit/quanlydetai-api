import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'

/**
 * Service ghi audit log để các module khác gọi khi cần ghi log hành động.
 */
export default class AuditLogService {
  /**
   * Ghi audit log
   */
  static async log(data: {
    userId?: number | null
    userName: string
    action: string
    entityType: string
    entityId?: string | null
    oldData?: object | null
    newData?: object | null
    ctx?: HttpContext
  }) {
    const ipAddress = data.ctx?.request.ip() ?? 'unknown'
    const userAgent = data.ctx?.request.header('user-agent') ?? 'unknown'

    await AuditLog.create({
      userId: data.userId ?? null,
      userName: data.userName,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      oldData: data.oldData ?? null,
      newData: data.newData ?? null,
      ipAddress,
      userAgent,
    })
  }

  /** Lấy user từ ctx (api guard) */
  private static getUserFromCtx(ctx?: HttpContext) {
    if (!ctx) return { id: undefined as number | undefined, fullName: 'System' }
    try {
      const user = ctx.auth.use('api').user
      return { id: user?.id, fullName: user?.fullName ?? 'System' }
    } catch {
      return { id: undefined as number | undefined, fullName: 'System' }
    }
  }

  /**
   * Log khi tạo mới
   */
  static async logCreate(
    entityType: string,
    entityId: string,
    newData: object,
    ctx?: HttpContext
  ) {
    const { id, fullName } = this.getUserFromCtx(ctx)
    await this.log({
      userId: id ?? null,
      userName: fullName,
      action: 'CREATE',
      entityType,
      entityId,
      newData,
      ctx,
    })
  }

  /**
   * Log khi cập nhật
   */
  static async logUpdate(
    entityType: string,
    entityId: string,
    oldData: object,
    newData: object,
    ctx?: HttpContext
  ) {
    const { id, fullName } = this.getUserFromCtx(ctx)
    await this.log({
      userId: id ?? null,
      userName: fullName,
      action: 'UPDATE',
      entityType,
      entityId,
      oldData,
      newData,
      ctx,
    })
  }

  /**
   * Log khi xóa
   */
  static async logDelete(
    entityType: string,
    entityId: string,
    oldData: object,
    ctx?: HttpContext
  ) {
    const { id, fullName } = this.getUserFromCtx(ctx)
    await this.log({
      userId: id ?? null,
      userName: fullName,
      action: 'DELETE',
      entityType,
      entityId,
      oldData,
      ctx,
    })
  }
}
