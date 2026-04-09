import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'
import { validateByKind } from '#services/research_output_rule_validator_service'

/** Cột sheet Bang1_QuyDoi (quy_doi_gio_NCKH.xlsx) */
const COL = {
  ma: 'mã công bố',
  cap0: 'Loại công bố cấp 0',
  cap1: 'Loại công bố cấp 1',
  cap2: 'Loại công bố cấp 2',
  diem: 'Số điểm quy đổi',
  gio: 'Số giờ NCKH quy đổi',
  minhChung: 'Minh chứng kết quả NCKH',
} as const

export interface ResearchOutputTypesImportError {
  rowNumber: number
  reason: string
}

export interface ResearchOutputTypesImportResult {
  total: number
  typesCreated: number
  typesSkipped: number
  rulesCreated: number
  failed: number
  errors: ResearchOutputTypesImportError[]
  logPath?: string
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).replace(/\r\n/g, '\n').trim()
}

function parseNumberLoose(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(/,/g, '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function firstNumberInText(s: string): number | null {
  const m = s.match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  return parseNumberLoose(m[0])
}

/** Phần số sau "c×" / "c x" (hỗ trợ dấu phẩy thập phân VN) */
function parseAfterCx(s: string): number | null {
  const m = str(s).match(/c\s*[×x]\s*([\d]+(?:[.,]\d+)?)/i)
  return m ? parseNumberLoose(m[1]) : null
}

function extractRoman(cap0: string): string | null {
  const m = str(cap0).match(/^([IVXLCDM]+)\s*[.)]/i)
  return m ? m[1].toUpperCase() : null
}

function extractL2Order(cap1: string): number {
  const m = str(cap1).match(/^(\d+)\s*[.)]/)
  return m ? parseInt(m[1], 10) : 0
}

function defaultCodeForRow(excelRow: number): string {
  return `QD_R${excelRow}`
}

type InferredRule =
  | { ruleKind: 'FIXED'; pointsValue: number; hoursValue: number }
  | { ruleKind: 'MULTIPLY_A'; pointsValue: number; hoursValue: number; hoursMultiplierVar: 'a' }
  | {
      ruleKind: 'HDGSNN_POINTS_TO_HOURS'
      pointsValue: null
      hoursValue: 600
      meta: { source: string; hours_per_point: number }
    }
  | {
      ruleKind: 'MULTIPLY_C'
      pointsValue: number
      hoursValue: number
      hoursMultiplierVar: 'c'
      meta: { c_map: Record<string, number> }
    }
  | { ruleKind: 'BONUS_ADD'; pointsValue: number; hoursValue: number; hoursBonus: number }

const DEFAULT_C_MAP = {
  EXCELLENT: 1.1,
  PASS_ON_TIME: 1.0,
  PASS_LATE: 0.5,
}

function inferRuleFromCells(pointsCell: string, hoursCell: string): InferredRule | null {
  const pRaw = str(pointsCell)
  const hRaw = str(hoursCell)
  const pLow = pRaw.toLowerCase()
  const hLow = hRaw.toLowerCase()

  if (!hRaw && !pRaw) return null

  if (
    hLow.includes('số điểm quy đổi') ||
    hLow.includes('so diem quy doi') ||
    (hLow.includes('600') && (hLow.includes('×') || hLow.includes('x')) && hLow.includes('điểm'))
  ) {
    return {
      ruleKind: 'HDGSNN_POINTS_TO_HOURS',
      pointsValue: null,
      hoursValue: 600,
      meta: { source: 'HDGSNN', hours_per_point: 600 },
    }
  }

  if (hLow.includes('cộng thêm') && hLow.includes('300')) {
    return {
      ruleKind: 'BONUS_ADD',
      pointsValue: 0,
      hoursValue: 0,
      hoursBonus: 300,
    }
  }

  if (/c\s*[×x]\s*\d/i.test(pRaw) || /c\s*[×x]\s*\d/i.test(hRaw)) {
    const basePoints = parseAfterCx(pRaw) ?? 1
    const baseHours = parseAfterCx(hRaw) ?? 0
    if (baseHours <= 0) return null
    return {
      ruleKind: 'MULTIPLY_C',
      pointsValue: basePoints,
      hoursValue: baseHours,
      hoursMultiplierVar: 'c',
      meta: { c_map: { ...DEFAULT_C_MAP } },
    }
  }

  if (/\bx\s*a\b/i.test(hRaw) || hLow.includes(' x a')) {
    const pts = parseNumberLoose(pRaw.replace(/[^\d.,-]/g, '')) ?? firstNumberInText(pRaw)
    const hrs = firstNumberInText(hRaw)
    if (pts === null || hrs === null) return null
    return {
      ruleKind: 'MULTIPLY_A',
      pointsValue: pts,
      hoursValue: hrs,
      hoursMultiplierVar: 'a',
    }
  }

  const pts = parseNumberLoose(pRaw.replace(/[^\d.,-]/g, '')) ?? firstNumberInText(pRaw)
  const hrs = parseNumberLoose(hRaw.replace(/[^\d.,-]/g, '')) ?? firstNumberInText(hRaw)
  if (pts === null || hrs === null) return null
  return {
    ruleKind: 'FIXED',
    pointsValue: pts,
    hoursValue: hrs,
  }
}

function ruleToPayload(r: InferredRule): {
  ruleKind: string
  pointsValue: number | null
  hoursValue: number | null
  hoursMultiplierVar: string | null
  hoursBonus: number | null
  meta: Record<string, unknown>
} {
  switch (r.ruleKind) {
    case 'FIXED':
      return {
        ruleKind: 'FIXED',
        pointsValue: r.pointsValue,
        hoursValue: r.hoursValue,
        hoursMultiplierVar: null,
        hoursBonus: null,
        meta: {},
      }
    case 'MULTIPLY_A':
      return {
        ruleKind: 'MULTIPLY_A',
        pointsValue: r.pointsValue,
        hoursValue: r.hoursValue,
        hoursMultiplierVar: 'a',
        hoursBonus: null,
        meta: {},
      }
    case 'HDGSNN_POINTS_TO_HOURS':
      return {
        ruleKind: 'HDGSNN_POINTS_TO_HOURS',
        pointsValue: null,
        hoursValue: 600,
        hoursMultiplierVar: null,
        hoursBonus: null,
        meta: { ...r.meta },
      }
    case 'MULTIPLY_C':
      return {
        ruleKind: 'MULTIPLY_C',
        pointsValue: r.pointsValue,
        hoursValue: r.hoursValue,
        hoursMultiplierVar: 'c',
        hoursBonus: null,
        meta: { ...r.meta },
      }
    case 'BONUS_ADD':
      return {
        ruleKind: 'BONUS_ADD',
        pointsValue: r.pointsValue,
        hoursValue: r.hoursValue,
        hoursMultiplierVar: null,
        hoursBonus: r.hoursBonus,
        meta: { bonus_note: 'Cộng thêm giờ (NXB uy tín / mục 6.7 file QĐ)' },
      }
    default:
      return {
        ruleKind: 'FIXED',
        pointsValue: 0,
        hoursValue: 0,
        hoursMultiplierVar: null,
        hoursBonus: null,
        meta: {},
      }
  }
}

async function nextChildSortOrder(parentId: number): Promise<number> {
  const row = await ResearchOutputType.query()
    .where('parent_id', parentId)
    .max('sort_order as m')
    .first()
  const m = (row as { $extras?: { m?: string | number | null } } | null)?.$extras?.m
  const n = m === undefined || m === null || m === '' ? 0 : Number(m)
  return (Number.isFinite(n) ? n : 0) + 1
}

/** Thứ tự sort cho node cấp 1 (parent_id null) */
async function nextRootSortOrder(): Promise<number> {
  const row = await ResearchOutputType.query().whereNull('parent_id').max('sort_order as m').first()
  const m = (row as { $extras?: { m?: string | number | null } } | null)?.$extras?.m
  const n = m === undefined || m === null || m === '' ? 0 : Number(m)
  return (Number.isFinite(n) ? n : 0) + 1
}

export interface RunResearchOutputTypesImportOptions {
  file?: string
  sheet?: string
  dryRun?: boolean
  /** TRUNCATE research_output_rules + research_output_types (mất toàn bộ cây cũ) */
  truncate?: boolean
}

/**
 * Import từ Excel quy đổi giờ NCKH → bảng research_output_types (3 cấp) + research_output_rules (lá).
 * Sheet mặc định Bang1_QuyDoi: cột cấp 0/1/2 khớp file prompts/quy_doi_gio_NCKH.xlsx.
 */
export default class ResearchOutputTypesImportService {
  static async runImport(opts: RunResearchOutputTypesImportOptions = {}): Promise<ResearchOutputTypesImportResult> {
    const filePath = path.resolve(
      opts.file?.trim() || path.join(process.cwd(), 'prompts', 'quy_doi_gio_NCKH.xlsx')
    )
    const sheetName = opts.sheet?.trim() || 'Bang1_QuyDoi'

    const result: ResearchOutputTypesImportResult = {
      total: 0,
      typesCreated: 0,
      typesSkipped: 0,
      rulesCreated: 0,
      failed: 0,
      errors: [],
    }

    if (!fs.existsSync(filePath)) {
      result.errors.push({ rowNumber: 0, reason: `Không tìm thấy file: ${filePath}` })
      result.failed = 1
      return result
    }

    const wb = XLSX.readFile(filePath)
    const ws = wb.Sheets[sheetName]
    if (!ws) {
      result.errors.push({ rowNumber: 0, reason: `Không có sheet: ${sheetName}` })
      result.failed = 1
      return result
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    result.total = rows.length

    const processRow = async (row: Record<string, unknown>, excelRow: number) => {
      const cap0 = str(row[COL.cap0])
      const cap1 = str(row[COL.cap1])
      const cap2 = str(row[COL.cap2])
      const diem = str(row[COL.diem])
      const gio = str(row[COL.gio])
      const minhChung = str(row[COL.minhChung])
      const maCongBo = str(row[COL.ma])

      if (!cap0 && !cap1 && !cap2) return

      const roman = extractRoman(cap0)
      if (!roman) {
        result.errors.push({
          rowNumber: excelRow,
          reason: `Không đọc được La Mã đầu dòng cấp 0: "${cap0.slice(0, 80)}"`,
        })
        result.failed++
        return
      }

      if (!cap1 || !cap2) {
        result.errors.push({ rowNumber: excelRow, reason: 'Thiếu tên cấp 1 hoặc cấp 2' })
        result.failed++
        return
      }

      const inferred = inferRuleFromCells(diem, gio)
      if (!inferred) {
        result.errors.push({
          rowNumber: excelRow,
          reason: `Không suy ra được rule từ điểm="${diem.slice(0, 40)}" / giờ="${gio.slice(0, 60)}"`,
        })
        result.failed++
        return
      }

      const rulePayload = ruleToPayload(inferred)
      try {
        validateByKind({
          ruleKind: rulePayload.ruleKind,
          pointsValue: rulePayload.pointsValue,
          hoursValue: rulePayload.hoursValue,
          hoursMultiplierVar: rulePayload.hoursMultiplierVar,
          hoursBonus: rulePayload.hoursBonus,
          meta: rulePayload.meta,
          evidenceRequirements: minhChung || null,
        })
      } catch (e) {
        result.errors.push({
          rowNumber: excelRow,
          reason: e instanceof Error ? e.message : String(e),
        })
        result.failed++
        return
      }

      let code = maCongBo.replace(/\s+/g, '_').toUpperCase()
      if (!code || code.length > 50) {
        code = defaultCodeForRow(excelRow)
      }
      if (code.length > 50) {
        code = defaultCodeForRow(excelRow)
      }

      if (opts.dryRun) {
        result.typesCreated++
        result.rulesCreated++
        return
      }

      const existingLeaf = await ResearchOutputType.query().where('code', code).first()
      if (existingLeaf && !opts.truncate) {
        result.typesSkipped++
        return
      }

      const l1Code = `QD_L1_${roman}`
      let l1 = await ResearchOutputType.query().where('code', l1Code).first()
      if (!l1) {
        l1 = await ResearchOutputType.create({
          parentId: null,
          code: l1Code,
          name: cap0,
          level: 1,
          sortOrder: await nextRootSortOrder(),
          isActive: true,
          note: `Import QĐ quy đổi giờ NCKH — nhóm ${roman}`,
        })
        result.typesCreated++
      }

      let l2 = await ResearchOutputType.query().where('parent_id', l1.id).where('name', cap1).first()
      if (!l2) {
        const cntRow = await ResearchOutputType.query().where('parent_id', l1.id).count('*', 'total').first()
        const siblingN =
          Number((cntRow as { $extras?: { total?: string } } | null)?.$extras?.total ?? 0) + 1
        const l2Num = extractL2Order(cap1) || siblingN
        let l2Code = `QD_L2_${l1.id}_${l2Num}`
        if (l2Code.length > 50) {
          l2Code = `Q2_${l1.id}_${siblingN}`.slice(0, 50)
        }
        l2 = await ResearchOutputType.create({
          parentId: l1.id,
          code: l2Code,
          name: cap1,
          level: 2,
          sortOrder: await nextChildSortOrder(l1.id),
          isActive: true,
          note: null,
        })
        result.typesCreated++
      }

      const leafSo = await nextChildSortOrder(l2.id)
      const leaf = await ResearchOutputType.create({
        parentId: l2.id,
        code,
        name: cap2,
        level: 3,
        sortOrder: leafSo,
        isActive: true,
        note: `Excel hàng ${excelRow}`,
      })
      result.typesCreated++

      await ResearchOutputRule.create({
        typeId: leaf.id,
        ruleKind: rulePayload.ruleKind,
        pointsValue: rulePayload.pointsValue,
        hoursValue: rulePayload.hoursValue,
        hoursMultiplierVar: rulePayload.hoursMultiplierVar,
        hoursBonus: rulePayload.hoursBonus,
        meta: rulePayload.meta,
        evidenceRequirements: minhChung || null,
      })
      result.rulesCreated++
    }

    const runAll = async () => {
      if (opts.truncate && !opts.dryRun) {
        await db.rawQuery(
          'TRUNCATE TABLE research_output_rules, research_output_types RESTART IDENTITY CASCADE'
        )
      }

      let excelRow = 2
      for (const row of rows) {
        await processRow(row, excelRow)
        excelRow++
      }
    }

    if (opts.dryRun) {
      await runAll()
    } else {
      await db.transaction(async () => {
        await runAll()
      })
    }

    const logsDir = path.join(process.cwd(), 'storage', 'import-logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const logPath = path.join(
      logsDir,
      `research-output-types-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    )
    fs.writeFileSync(
      logPath,
      JSON.stringify(
        {
          file: filePath,
          sheet: sheetName,
          dryRun: !!opts.dryRun,
          truncate: !!opts.truncate,
          ...result,
        },
        null,
        2
      ),
      'utf-8'
    )
    result.logPath = logPath

    return result
  }
}
