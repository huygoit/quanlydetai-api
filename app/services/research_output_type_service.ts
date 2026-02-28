import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'

/**
 * Service cho cây loại kết quả NCKH: tree, level, cycle check, leaf.
 */
export default class ResearchOutputTypeService {
  /**
   * Cây lồng nhau, sắp theo sort_order. Mỗi node: id, code, name, level, sortOrder, isActive, hasRule, children.
   */
  static async getTree(): Promise<
    Array<{
      id: number
      code: string
      name: string
      level: number
      sortOrder: number
      isActive: boolean
      hasRule: boolean
      children: Array<unknown>
    }>
  > {
    const roots = await ResearchOutputType.query()
      .whereNull('parent_id')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    return Promise.all(roots.map((r) => this.buildTreeNode(r)))
  }

  private static async buildTreeNode(
    node: ResearchOutputType
  ): Promise<{
    id: number
    code: string
    name: string
    level: number
    sortOrder: number
    isActive: boolean
    hasRule: boolean
    children: Array<unknown>
  }> {
    const hasRule = await ResearchOutputRule.query().where('type_id', node.id).first().then((r) => !!r)
    const children = await ResearchOutputType.query()
      .where('parent_id', node.id)
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    const childNodes = await Promise.all(children.map((c) => this.buildTreeNode(c)))
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      level: node.level,
      sortOrder: node.sortOrder,
      isActive: node.isActive,
      hasRule,
      children: childNodes,
    }
  }

  /** Kiểm tra không tạo chu trình: newParentId không được là typeId hoặc tổ tiên của typeId. */
  static async assertNoCycle(typeId: number, newParentId: number | null): Promise<void> {
    if (newParentId === null) return
    if (newParentId === typeId) {
      throw new Error('parent không được là chính node này')
    }
    let currentId: number | null = newParentId
    const visited = new Set<number>([typeId])
    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error('Không được tạo chu trình (parent là con cháu của node)')
      }
      visited.add(currentId)
      const parent = await ResearchOutputType.find(currentId)
      currentId = parent?.parentId ?? null
    }
  }

  /** Tính level khi đặt parent = newParentId. Level 1 nếu null, còn lại parent.level + 1. */
  static async computeLevel(newParentId: number | null): Promise<number> {
    if (newParentId === null) return 1
    const parent = await ResearchOutputType.find(newParentId)
    if (!parent) throw new Error('Không tìm thấy parent')
    if (parent.level >= 3) throw new Error('Đã đạt độ sâu tối đa (3), không thể thêm con')
    return parent.level + 1
  }

  /** Kiểm tra node có phải leaf (không có con). */
  static async isLeaf(typeId: number): Promise<boolean> {
    const type = await ResearchOutputType.find(typeId)
    if (!type) return false
    return type.isLeaf()
  }
}
