import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineRevisionService from '#services/project_outline_revision_service'
import ProjectOutlineService from '#services/project_outline_service'

/**
 * Gửi lại thông báo + email «cần hoàn thiện thuyết minh» cho CNĐT và thành viên.
 * Ví dụ: node ace resend:outline-revision-notify 1
 */
export default class ResendOutlineRevisionNotify extends BaseCommand {
  static commandName = 'resend:outline-revision-notify'
  static description = 'Gửi lại thông báo hoàn thiện thuyết minh cho toàn bộ thành viên đề tài'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'ID thuyết minh (project_outlines.id)' })
  declare outlineId: string

  async run() {
    const id = Number(this.outlineId)
    if (!Number.isFinite(id) || id <= 0) {
      this.logger.error('outlineId không hợp lệ')
      return
    }

    const outline = await ProjectOutline.find(id)
    if (!outline) {
      this.logger.error(`Không tìm thấy thuyết minh #${id}`)
      return
    }

    const session = outline.activeDefenseSessionId
      ? await ProjectOutlineDefenseSession.find(outline.activeDefenseSessionId)
      : await ProjectOutlineDefenseSession.query()
          .where('project_outline_id', outline.id)
          .orderBy('id', 'desc')
          .first()

    if (!session) {
      this.logger.error('Không có phiên thẩm định gắn với thuyết minh này.')
      return
    }

    const memberIds = await ProjectOutlineService.memberUserIds(outline.id)
    this.logger.info(
      `${outline.code}: owner=${outline.ownerId}, members=${memberIds.join(',') || '(không có)'}`
    )

    await ProjectOutlineRevisionService.notifyTeamNeedRevision(outline, session)
    this.logger.success(`Đã gửi lại thông báo cho ${outline.code}.`)
  }
}
