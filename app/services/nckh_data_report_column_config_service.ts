import SystemConfig from '#models/system_config'
import ResearchOutputType from '#models/research_output_type'

/** Khóa cấu hình cột báo cáo Thống kê kết quả NCKH */
export const NCKH_DATA_REPORT_COLUMNS_KEY = 'nckh_data_report_columns'

export type NckhDataColumnSelection = {
  level1Ids: number[]
  level2Ids: number[]
  level3Ids: number[]
}

export type NckhDataColumnNode = {
  id: number
  code: string
  name: string
  level: number
  children: NckhDataColumnNode[]
}

export type NckhDataLeafColumn = {
  id: number
  code: string
  name: string
  level1Id: number
  level2Id: number
}

type FlatType = {
  id: number
  code: string
  name: string
  level: number
  parentId: number | null
  isActive: boolean
  sortOrder: number
}

/**
 * Đọc/ghi cấu hình cột báo cáo nckh-data theo danh mục loại KQNC (3 cấp).
 * value JSON: { level1Ids, level2Ids, level3Ids }.
 * Chưa có cấu hình → mặc định chọn hết node đang active (tránh báo cáo trống lần đầu).
 */
export default class NckhDataReportColumnConfigService {
  static emptySelection(): NckhDataColumnSelection {
    return { level1Ids: [], level2Ids: [], level3Ids: [] }
  }

  static parseValue(raw: string | null | undefined): NckhDataColumnSelection | null {
    if (raw == null || String(raw).trim() === '') return null
    try {
      const parsed = JSON.parse(String(raw)) as Partial<NckhDataColumnSelection>
      return {
        level1Ids: chuanHoaIdList(parsed.level1Ids),
        level2Ids: chuanHoaIdList(parsed.level2Ids),
        level3Ids: chuanHoaIdList(parsed.level3Ids),
      }
    } catch {
      return null
    }
  }

  /** Đảm bảo có dòng system_configs cho khóa này. */
  static async ensureRow(): Promise<SystemConfig> {
    let row = await SystemConfig.findBy('key', NCKH_DATA_REPORT_COLUMNS_KEY)
    if (!row) {
      row = await SystemConfig.create({
        key: NCKH_DATA_REPORT_COLUMNS_KEY,
        value: null,
        description:
          'Cột hiển thị báo cáo Thống kê kết quả NCKH (JSON: level1Ids, level2Ids, level3Ids)',
      })
    }
    return row
  }

  static async loadAllTypes(): Promise<FlatType[]> {
    const rows = await ResearchOutputType.query()
      .select('id', 'code', 'name', 'level', 'parentId', 'isActive', 'sortOrder')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    return rows.map((t) => ({
      id: Number(t.id),
      code: String(t.code || ''),
      name: String(t.name || ''),
      level: Number(t.level),
      parentId: t.parentId != null ? Number(t.parentId) : null,
      isActive: !!t.isActive,
      sortOrder: Number(t.sortOrder ?? 0),
    }))
  }

  /** Selection đã lọc theo id tồn tại; isDefaultAll = chưa từng lưu cấu hình. */
  static async getSelection(): Promise<{
    selection: NckhDataColumnSelection
    isDefaultAll: boolean
    allTypes: FlatType[]
  }> {
    const row = await this.ensureRow()
    const allTypes = await this.loadAllTypes()
    const active = allTypes.filter((t) => t.isActive)
    const parsed = this.parseValue(row.value)
    if (!parsed) {
      return {
        selection: {
          level1Ids: active.filter((t) => t.level === 1).map((t) => t.id),
          level2Ids: active.filter((t) => t.level === 2).map((t) => t.id),
          level3Ids: active.filter((t) => t.level === 3).map((t) => t.id),
        },
        isDefaultAll: true,
        allTypes,
      }
    }
    const idSet = new Set(allTypes.map((t) => t.id))
    return {
      selection: {
        level1Ids: parsed.level1Ids.filter((id) => idSet.has(id)),
        level2Ids: parsed.level2Ids.filter((id) => idSet.has(id)),
        level3Ids: parsed.level3Ids.filter((id) => idSet.has(id)),
      },
      isDefaultAll: false,
      allTypes,
    }
  }

  static async saveSelection(input: NckhDataColumnSelection): Promise<NckhDataColumnSelection> {
    const allTypes = await this.loadAllTypes()
    const byId = new Map(allTypes.map((t) => [t.id, t]))
    const hopLe = (ids: number[], level: number) =>
      chuanHoaIdList(ids).filter((id) => {
        const t = byId.get(id)
        return !!t && t.level === level
      })

    const level1Ids = new Set(hopLe(input.level1Ids, 1))
    const level2Ids = new Set(hopLe(input.level2Ids, 2))
    const level3Ids = hopLe(input.level3Ids, 3)

    // Bổ sung tổ tiên của L3 đã chọn (Tree antd nửa-check không đưa cha vào checkedKeys)
    for (const id of level3Ids) {
      const l3 = byId.get(id)
      if (!l3?.parentId) continue
      const l2 = byId.get(l3.parentId)
      if (!l2 || l2.level !== 2) continue
      level2Ids.add(l2.id)
      if (l2.parentId) {
        const l1 = byId.get(l2.parentId)
        if (l1 && l1.level === 1) level1Ids.add(l1.id)
      }
    }
    // Bổ sung L1 của L2 đã chọn
    for (const id of level2Ids) {
      const l2 = byId.get(id)
      if (!l2?.parentId) continue
      const l1 = byId.get(l2.parentId)
      if (l1 && l1.level === 1) level1Ids.add(l1.id)
    }

    const selection: NckhDataColumnSelection = {
      level1Ids: [...level1Ids],
      level2Ids: [...level2Ids],
      level3Ids,
    }

    const row = await this.ensureRow()
    row.value = JSON.stringify(selection)
    await row.save()
    return selection
  }

  /**
   * Cây header chỉ gồm L1→L2→L3 đã chọn và có ít nhất một lá L3.
   * leafColumns: thứ tự cột dữ liệu (trái → phải).
   */
  static buildDisplayColumns(
    allTypes: FlatType[],
    selection: NckhDataColumnSelection
  ): { columnTree: NckhDataColumnNode[]; leafColumns: NckhDataLeafColumn[] } {
    const l1Set = new Set(selection.level1Ids)
    const l2Set = new Set(selection.level2Ids)
    const l3Set = new Set(selection.level3Ids)

    const byParent = new Map<number | null, FlatType[]>()
    for (const t of allTypes) {
      if (!t.isActive) continue
      const p = t.parentId
      if (!byParent.has(p)) byParent.set(p, [])
      byParent.get(p)!.push(t)
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    }

    const leafColumns: NckhDataLeafColumn[] = []
    const columnTree: NckhDataColumnNode[] = []

    const roots = (byParent.get(null) || []).filter((t) => t.level === 1 && l1Set.has(t.id))
    for (const l1 of roots) {
      const l2Nodes: NckhDataColumnNode[] = []
      const l2s = (byParent.get(l1.id) || []).filter((t) => t.level === 2 && l2Set.has(t.id))
      for (const l2 of l2s) {
        const l3s = (byParent.get(l2.id) || []).filter((t) => t.level === 3 && l3Set.has(t.id))
        if (l3s.length === 0) continue
        const l3Nodes: NckhDataColumnNode[] = l3s.map((l3) => {
          leafColumns.push({
            id: l3.id,
            code: l3.code,
            name: l3.name,
            level1Id: l1.id,
            level2Id: l2.id,
          })
          return {
            id: l3.id,
            code: l3.code,
            name: l3.name,
            level: 3,
            children: [],
          }
        })
        l2Nodes.push({
          id: l2.id,
          code: l2.code,
          name: l2.name,
          level: 2,
          children: l3Nodes,
        })
      }
      if (l2Nodes.length === 0) continue
      columnTree.push({
        id: l1.id,
        code: l1.code,
        name: l1.name,
        level: 1,
        children: l2Nodes,
      })
    }

    return { columnTree, leafColumns }
  }
}

function chuanHoaIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  const seen = new Set<number>()
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    if (!Number.isFinite(n) || n <= 0) continue
    const id = Math.trunc(n)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
