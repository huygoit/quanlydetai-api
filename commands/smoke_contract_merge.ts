import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFile } from 'node:fs/promises'
import PizZip from 'pizzip'
import ProjectOutline from '#models/project_outline'
import ProjectContractService from '#services/project_contract_service'

export default class SmokeContractMerge extends BaseCommand {
  static commandName = 'smoke:contract-merge'
  static description = 'Sinh thử hợp đồng từ TM và kiểm tra mục tiêu / nội dung / bảng SP'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Mã thuyết minh', required: false })
  declare code: string

  async run() {
    const code = String(this.code || 'TM-2026-SEED')
    const outline = await ProjectOutline.query().where('code', code).first()
    if (!outline) {
      this.logger.error(`Không thấy ${code}`)
      this.exitCode = 1
      return
    }

    this.logger.info(
      `code=${code} detailedObjectives=${!!outline.detailedObjectives} research=${!!outline.researchContent} er.pubs=${outline.expectedResults?.publications?.length || 0}`
    )

    if (!outline.module5Opened) {
      outline.module5Opened = true
      outline.status = 'SAN_SANG_THUC_HIEN' as any
      await outline.save()
    }

    const ProjectContract = (await import('#models/project_contract')).default
    const existing = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .first()
    const statusCu = existing?.status
    if (existing && existing.status !== 'HOP_DONG_DRAFT') {
      this.logger.warning(`status=${existing.status} → tạm đặt HOP_DONG_DRAFT để smoke`)
      existing.status = 'HOP_DONG_DRAFT' as any
      await existing.save()
    }

    const { row } = await ProjectContractService.generateDraft(outline, null, {
      forceRegen: true,
      silent: true,
    })

    if (statusCu && statusCu !== 'HOP_DONG_DRAFT') {
      row.status = statusCu as any
      await row.save()
      this.logger.info(`Khôi phục status=${statusCu}`)
    }

    const path = row.storedFileName
      ? await (
          await import('#utils/docx_merge_helper')
        ).findGeneratedContractFilePath(row.storedFileName)
      : null
    if (!path) {
      this.logger.error('Không tìm file đã sinh')
      this.exitCode = 1
      return
    }

    const buf = await readFile(path)
    const xml = new PizZip(buf).file('word/document.xml')?.asText() || ''
    const plain = xml
      .replace(/<w:tab[^/]*\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')

    const checks = {
      size: row.fileSize,
      hasNhanMucTieu: /Mục tiêu\s*:/.test(plain),
      hasNhanNoiDung: /Nội dung thực hiện\s*:/.test(plain),
      hasNhanSanPham: /Sản phẩm và yêu cầu chất lượng\s*:/.test(plain),
      hasChiTietMucTieu:
        /mục tiêu cụ thể|khung năng lực|xây dựng hệ thống/i.test(plain),
      hasNoiDung:
        /Nội dung 1|Khảo sát hiện trạng|Nội dung thực hiện/i.test(plain),
      hasHtmlLeak: /<\/?(p|ul|li|strong)\b/i.test(plain),
      hasCongBo: /Công bố khoa học/i.test(plain),
      hasBang: (xml.match(/<w:tbl[\s>]/g) || []).length,
      leftoverHtml: /___HTML_/.test(xml),
      leftoverBang: /___BANG_/.test(xml),
      snippetMuc: plain.match(/Mục tiêu[\s\S]{0,220}/)?.[0]?.slice(0, 200),
      snippetNd: plain.match(/Nội dung thực hiện[\s\S]{0,220}/)?.[0]?.slice(0, 200),
      snippetSp: plain.match(/Sản phẩm và yêu cầu[\s\S]{0,280}/)?.[0]?.slice(0, 250),
    }
    this.logger.info(JSON.stringify(checks, null, 2))
    if (
      checks.leftoverHtml ||
      checks.leftoverBang ||
      checks.hasHtmlLeak ||
      !checks.hasChiTietMucTieu ||
      !checks.hasNhanMucTieu ||
      !checks.hasNhanNoiDung ||
      !checks.hasNhanSanPham
    ) {
      this.exitCode = 1
    }
  }
}
