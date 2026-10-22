import type { HttpContext } from '@adonisjs/core/http'
import BackupService, { LoiSaoLuu } from '#services/backup_service'

/** Sao lưu / khôi phục — chỉ Super Admin (quyền *). */
export default class AdminBackupsController {
  private loi(response: HttpContext['response'], err: unknown) {
    if (err instanceof LoiSaoLuu) {
      return response.badRequest({ success: false, message: err.message })
    }
    throw err
  }

  async index({ response }: HttpContext) {
    const files = await BackupService.danhSach()
    return response.ok({
      success: true,
      data: {
        databaseName: BackupService.tenDatabase(),
        files,
      },
    })
  }

  async store({ response }: HttpContext) {
    try {
      const file = await BackupService.tao()
      return response.created({ success: true, data: file })
    } catch (err) {
      return this.loi(response, err)
    }
  }

  async download({ request, response }: HttpContext) {
    try {
      const ten = String(request.input('name', ''))
      const dayDu = await BackupService.duongDanTai(ten)
      response.header('Content-Type', 'application/zip')
      response.header('Content-Disposition', `attachment; filename="${ten}"`)
      return response.download(dayDu)
    } catch (err) {
      return this.loi(response, err)
    }
  }

  async destroy({ request, response }: HttpContext) {
    try {
      await BackupService.xoa(String(request.input('name', '')))
      return response.ok({ success: true })
    } catch (err) {
      return this.loi(response, err)
    }
  }

  async upload({ request, response }: HttpContext) {
    const file = request.file('file', {
      size: '1024mb',
      extnames: ['zip'],
    })
    if (!file) {
      return response.badRequest({ success: false, message: 'Chưa chọn file zip.' })
    }
    if (!file.isValid) {
      return response.badRequest({ success: false, message: file.errors[0]?.message || 'File không hợp lệ.' })
    }
    try {
      const saved = await BackupService.nhanFile(file.tmpPath!, file.clientName)
      return response.created({ success: true, data: saved })
    } catch (err) {
      return this.loi(response, err)
    }
  }

  async restore({ request, response }: HttpContext) {
    const fileName = String(request.input('fileName', ''))
    const confirmName = String(request.input('confirmName', ''))
    try {
      await BackupService.khoiPhuc(fileName, confirmName)
      return response.ok({ success: true, message: 'Đã khôi phục dữ liệu.' })
    } catch (err) {
      return this.loi(response, err)
    }
  }
}
