/**
 * Xuất DOCX thuyết minh từ mẫu BM-02.02 (THUYET_MINH).
 */
import ProjectOutline from '#models/project_outline'
import ContractTemplateService from '#services/contract_template_service'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import {
  buildBm0202HtmlBlocks,
  buildBm0202MergeData,
  buildBm0202TableBlocks,
} from '#utils/outline_thuyet_minh_merge'
import { mergeDocxTemplate } from '#utils/docx_merge_helper'

export default class OutlineExportService {
  /**
   * Merge dữ liệu outline vào mẫu THUYET_MINH mặc định → file DOCX.
   * Editor HTML → OOXML (đậm/nghiêng/danh sách); bang_* → bảng Word thật.
   */
  static async exportDocx(outlineId: number) {
    const outline = await ProjectOutline.query()
      .where('id', outlineId)
      .preload('members')
      .first()
    if (!outline) throw new Error('OUTLINE_NOT_FOUND')

    const template = await ContractTemplateService.getDefaultActive('THUYET_MINH')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')

    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    const data = buildBm0202MergeData(outline)
    const htmlBlocks = buildBm0202HtmlBlocks(outline)
    const tableBlocks = buildBm0202TableBlocks(outline)
    const safeCode = outline.code.replace(/[^\w.-]/g, '_')
    const merged = await mergeDocxTemplate({
      templatePath,
      data,
      htmlBlocks,
      tableBlocks,
      outputFileName: `TM_${safeCode}_${Date.now()}.docx`,
    })

    const fileName = `BM-02.02_${safeCode}.docx`
    return {
      outline,
      template,
      fileName,
      storedFileName: merged.storedFileName,
      fileUrl: merged.fileUrl,
      fileSize: merged.fileSize,
      fullPath: merged.fullPath,
    }
  }
}
