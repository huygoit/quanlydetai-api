/**
 * Đếm số đề tài khác nhau trên sheet SV NCKH theo logic gộp Detai_name + năm (sau chuẩn hoá),
 * giống khóa studentResearchIdentityKey khi import.
 *
 * Chạy: node scripts/count_unique_sv_nckh_from_excel.cjs [đường_dẫn_file.xlsx] [tên_sheet]
 * Mặc định: prompts/KH_CNTT_2025_2026.xlsx và SVNCKH2025_2026
 */
const path = require('node:path')
const XLSX = require('xlsx')

function normalizeGroupKey(v) {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function main() {
  const file = path.resolve(process.cwd(), process.argv[2] || 'prompts/KH_CNTT_2025_2026.xlsx')
  const sheetName = process.argv[3] || 'SVNCKH2025_2026'
  const wb = XLSX.readFile(file)
  const sheet = wb.Sheets[sheetName]
  if (!sheet) {
    console.error('Không thấy sheet:', sheetName, '| có:', wb.SheetNames.join(', '))
    process.exit(1)
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (rows.length === 0) {
    console.log('Sheet trống')
    return
  }

  const yearKey = Object.keys(rows[0]).find((k) => k === '\u006e\u0103\u006d') || 'năm'
  const normToKey = new Map()
  for (const k of Object.keys(rows[0])) {
    const nk = String(k)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!normToKey.has(nk)) normToKey.set(nk, k)
  }
  const detaiCol =
    normToKey.get(
      String('detai_name')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
    ) || 'Detai_name'

  let ctxTitle = ''
  const byYear = { 2025: new Set(), 2026: new Set() }

  for (const r of rows) {
    const raw = String(r[detaiCol] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const t = raw || ctxTitle
    ctxTitle = t
    const y = Number(r[yearKey])
    if (!t || (y !== 2025 && y !== 2026)) continue
    const ik = `${normalizeGroupKey(t)}\x1F${String(y).trim()}`
    byYear[y].add(ik)
  }

  const n25 = byYear[2025].size
  const n26 = byYear[2026].size
  console.log('File:', file)
  console.log('Sheet:', sheetName)
  console.log('Số đề tài duy nhất (Detai_name chuẩn hoá + năm), không tính đơn vị:')
  console.log('  Năm 2025:', n25)
  console.log('  Năm 2026:', n26)
  console.log('  Tổng:', n25 + n26)
}

main()
