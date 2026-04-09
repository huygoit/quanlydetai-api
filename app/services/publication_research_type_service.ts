import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'
import ResearchOutputTypeService from '#services/research_output_type_service'

/**
 * Kiểm tra lá danh mục NCKH khi gắn vào công bố (có rule; HĐGSNN cần điểm).
 */
export default class PublicationResearchTypeService {
  static async validateLeafWithRule(
    typeId: number,
    hdgsnnScore?: number | null,
    isbn?: string | null
  ): Promise<void> {
    const type = await ResearchOutputType.find(typeId)
    if (!type || !type.isActive) {
      throw new Error('Loại kết quả không tồn tại hoặc đã tắt.')
    }
    if (!(await ResearchOutputTypeService.isLeaf(typeId))) {
      throw new Error('Chỉ được chọn mục lá (cấp cuối) trong danh mục loại kết quả NCKH.')
    }
    const rule = await ResearchOutputRule.query().where('type_id', typeId).first()
    if (!rule) {
      throw new Error('Loại kết quả chưa có quy tắc quy đổi giờ.')
    }
    const k = (rule.ruleKind || '').toUpperCase()
    if (k === 'HDGSNN_POINTS_TO_HOURS') {
      const s = hdgsnnScore != null ? Number(hdgsnnScore) : 0
      if (!Number.isFinite(s) || s <= 0) {
        throw new Error('Với loại HĐGSNN, vui lòng nhập điểm quy đổi (điểm HĐGSNN) lớn hơn 0.')
      }
    }
    if (type.code === 'PUB_CONF_ISBN') {
      const v = String(isbn ?? '').trim()
      if (!v) {
        throw new Error('Với loại Hội thảo có ISBN, vui lòng nhập ISBN hợp lệ.')
      }
    }
  }
}
