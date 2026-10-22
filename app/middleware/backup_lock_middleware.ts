import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { khoaDangBat } from '#services/backup_lock'

/** Khi đang khôi phục, từ chối request khác để không ghi đè lẫn nhau. */
export default class BackupLockMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    if (khoaDangBat()) {
      return response.status(503).json({
        success: false,
        message: 'Hệ thống đang khôi phục dữ liệu. Vui lòng thử lại sau.',
      })
    }
    return next()
  }
}
