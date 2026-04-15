import fs from 'node:fs'
import path from 'node:path'
import xlsx from 'xlsx'
import JournalIndexEntry from '#models/journal_index_entry'

type ImportResult = {
  total: number
  inserted: number
  updated: number
  skipped: number
  errors: Array<{ row: number; reason: string }>
}

function normalizeIssn(raw: unknown): string | null {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .trim()
  if (!s) return null
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

function normalizeQuartile(raw: unknown): 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NO_Q' | null {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (!s) return null
  if (s === 'Q1' || s === 'Q2' || s === 'Q3' || s === 'Q4') return s
  if (s === 'NO_Q' || s === 'NOQ' || s === 'NQ' || s === 'CHUA_Q' || s === 'CHUA CO Q') return 'NO_Q'
  return null
}

function toBool(raw: unknown): boolean {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'co' || s === 'x'
}

function readRows(file: string, sheet?: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Không tìm thấy file: ${file}`)
  }
  const wb = xlsx.readFile(file)
  const sh = sheet ? wb.Sheets[sheet] : wb.Sheets[wb.SheetNames[0]]
  if (!sh) throw new Error('Không tìm thấy sheet cần import')
  return xlsx.utils.sheet_to_json<Record<string, unknown>>(sh, { defval: '' })
}

export default class JournalIndexImportService {
  static async run(params: {
    file: string
    sheet?: string
    sourceProvider?: string
    dryRun?: boolean
    year?: number
  }): Promise<ImportResult> {
    const rows = readRows(path.resolve(params.file), params.sheet)
    const result: ImportResult = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2
      const r = rows[i]!
      const isScimagoRow = r.Sourceid !== undefined || r['SJR Best Quartile'] !== undefined
      const year = Number(params.year ?? r.year ?? r.nam ?? r['Năm'] ?? r['Year'])
      let issn: string | null
      let issnL: string | null
      let journalName: string | null
      let quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NO_Q' | null
      let inScieSsciAhci: boolean
      let inScopus: boolean
      let inEsci: boolean
      let sourceNote: string | null

      if (isScimagoRow) {
        const type = String(r.Type ?? '').trim().toLowerCase()
        if (type !== 'journal') {
          result.skipped++
          continue
        }
        const coverage = String(r.Coverage ?? '').trim()
        if (params.year && coverage && !coverage.includes(String(params.year))) {
          result.skipped++
          continue
        }
        const issnParts = String(r.Issn ?? '')
          .split(',')
          .map((x) => normalizeIssn(x))
          .filter((x): x is string => Boolean(x))
        issn = issnParts[0] ?? null
        issnL = issnParts[1] ?? issnParts[0] ?? null
        journalName = String(r.Title ?? '').trim() || null
        quartile = normalizeQuartile(r['SJR Best Quartile'])
        inScieSsciAhci = false
        inScopus = true
        inEsci = false
        sourceNote =
          `sourceid=${String(r.Sourceid ?? '').trim()}; coverage=${coverage}; raw_issn=${String(r.Issn ?? '').trim()}` ||
          null
      } else {
        issn = normalizeIssn(r.issn ?? r.ISSN)
        issnL = normalizeIssn(r.issn_l ?? r.issnl ?? r['ISSN-L'])
        journalName = String(r.journal_name ?? r['Journal Name'] ?? r.journal ?? '').trim() || null
        quartile = normalizeQuartile(r.quartile ?? r.q ?? r['Quartile'])
        inScieSsciAhci = toBool(r.in_scie_ssci_ahci ?? r.wos_core ?? r.scie_ssci_ahci)
        inScopus = toBool(r.in_scopus ?? r.scopus)
        inEsci = toBool(r.in_esci ?? r.esci)
        sourceNote = String(r.source_note ?? r.note ?? '').trim() || null
      }

      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        result.errors.push({ row: rowNo, reason: 'Năm không hợp lệ' })
        continue
      }
      if (!issn && !issnL) {
        result.errors.push({ row: rowNo, reason: 'Thiếu ISSN/ISSN-L' })
        continue
      }

      const whereField = issn ? 'issn' : 'issn_l'
      const whereValue = issn ?? issnL
      const existed = await JournalIndexEntry.query()
        .where('year', year)
        .where(whereField, whereValue)
        .first()

      const payload = {
        year,
        issn: issn ?? null,
        issnL: issnL ?? null,
        journalName,
        inScieSsciAhci,
        inScopus,
        inEsci,
        quartile,
        sourceProvider: params.sourceProvider ?? (isScimagoRow ? 'SCIMAGO' : null),
        sourceNote,
      }

      if (params.dryRun) {
        if (existed) result.updated++
        else result.inserted++
        continue
      }

      if (existed) {
        existed.merge(payload)
        await existed.save()
        result.updated++
      } else {
        await JournalIndexEntry.create(payload)
        result.inserted++
      }
    }

    return result
  }
}
