import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectFinalCase from '#models/project_final_case'
import ProjectFinalSheet from '#models/project_final_sheet'

/**
 * Seed phiếu ĐGCK còn thiếu cho TM-2026-SEED.
 * node ace seed:tm2026-remaining-sheets
 */
export default class SeedTm2026RemainingSheets extends BaseCommand {
  static commandName = 'seed:tm2026-remaining-sheets'
  static description = 'Seed phiếu đánh giá KQCK còn thiếu cho TM-2026-SEED'

  static options: CommandOptions = { startApp: true }

  async run() {
    const outline = await ProjectOutline.query().where('code', 'TM-2026-SEED').first()
    if (!outline) {
      this.logger.error('Không tìm thấy TM-2026-SEED')
      this.exitCode = 1
      return
    }

    const row = await ProjectFinalCase.query()
      .where('project_outline_id', outline.id)
      .first()
    if (!row) {
      this.logger.error('Chưa có project_final_cases')
      this.exitCode = 1
      return
    }

    const members = row.councilMembers || []
    if (!members.length) {
      this.logger.error('Hội đồng chưa có thành viên')
      this.exitCode = 1
      return
    }

    const sheets = await ProjectFinalSheet.query().where('project_outline_id', outline.id)
    const submittedIds = new Set(
      sheets.filter((s) => s.submittedAt).map((s) => Number(s.userId))
    )

    const missing = members.filter(
      (m) => !submittedIds.has(Number((m as any).userId ?? (m as any).user_id))
    )

    this.logger.info(
      `Outline #${outline.id} ${outline.code} | HĐ=${members.length} | đã nộp=${submittedIds.size} | còn thiếu=${missing.length}`
    )

    if (!missing.length) {
      this.logger.success('Không còn thành viên thiếu phiếu')
      return
    }

    const er = outline.expectedResults as any
    const productRows: any[] = []
    const push = (key: string, title: string) => {
      productRows.push({
        key,
        name: title,
        soLuong: 'DAT',
        chatLuong: 'DAT',
        soLuongNote: '',
        chatLuongNote: '',
        note: '',
        actual: 'DAT',
        comment: '',
      })
    }
    for (const r of er?.publications || []) {
      if (r?.content?.trim()) push(`pub:${r.id}`, r.content.trim())
    }
    for (const r of er?.appliedProducts || []) {
      if (r?.name?.trim()) push(`app:${r.id}`, r.name.trim())
    }
    for (const r of er?.tangibleProducts || []) {
      if (r?.name?.trim()) push(`tan:${r.id}`, r.name.trim())
    }
    for (const r of er?.ipProducts || []) {
      if (r?.name?.trim()) push(`ip:${r.id}`, r.name.trim())
    }
    for (const r of er?.postgraduateTraining || []) {
      if (r?.level?.trim() || r?.major?.trim()) {
        const title = [r.level?.trim(), r.major?.trim(), r.quantity?.trim()]
          .filter(Boolean)
          .join(' — ')
        push(`trn:${r.id}`, title)
      }
    }
    if (!productRows.length) {
      for (const p of outline.expectedProducts || []) {
        if (p?.name) push(`legacy:${p.name}`, p.name)
      }
    }
    if (!productRows.length) {
      push('seed:sp1', 'Sản phẩm seed ĐGCK')
    }

    const now = DateTime.now()
    for (const m of missing) {
      const uid = Number((m as any).userId ?? (m as any).user_id)
      const name = String((m as any).fullName || (m as any).name || uid)
      let sheet = sheets.find((s) => Number(s.userId) === uid)
      if (!sheet) {
        sheet = new ProjectFinalSheet()
        sheet.projectOutlineId = outline.id
        sheet.userId = uid
      }
      sheet.productRows = productRows
      sheet.volumeComment = 'DAT'
      sheet.qualityComment = ''
      sheet.reportComment = 'DAT_YEU_CAU'
      sheet.generalComment = JSON.stringify({
        supplementContent: '',
        otherRecommendation: `Seed phiếu cho ${name}`,
      })
      sheet.submittedAt = now
      await sheet.save()
      this.logger.success(`Đã seed phiếu userId=${uid} (${name}) role=${(m as any).role}`)
    }

    this.logger.success(`Xong — đã seed ${missing.length} phiếu còn thiếu`)
  }
}
