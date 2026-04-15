import JournalIndexEntry, { type JournalQuartile } from '#models/journal_index_entry'
import ResearchOutputType from '#models/research_output_type'

export type JournalIndexResolution = {
  found: boolean
  code: string | null
  typeId: number | null
  quartile: JournalQuartile | null
  needsConfirmation: boolean
  reason: string
}

function normalizeIssn(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .trim()
}

function quartileToWosCode(q: JournalQuartile | null): string {
  if (q === 'Q1') return 'QD_R2'
  if (q === 'Q2') return 'QD_R3'
  if (q === 'Q3') return 'QD_R4'
  if (q === 'Q4') return 'QD_R5'
  return 'QD_R6'
}

function quartileToScopusCode(q: JournalQuartile | null): string {
  if (q === 'Q1') return 'QD_R7'
  if (q === 'Q2') return 'QD_R8'
  if (q === 'Q3') return 'QD_R9'
  if (q === 'Q4') return 'QD_R10'
  return 'QD_R11'
}

async function codeToTypeId(code: string): Promise<number | null> {
  const t = await ResearchOutputType.query().where('code', code).first()
  return t?.id ?? null
}

export default class JournalIndexLookupService {
  static async resolveByIssn(params: {
    issn?: string | null
    issnL?: string | null
    year?: number | null
  }): Promise<JournalIndexResolution> {
    const year = params.year && Number.isFinite(params.year) ? Number(params.year) : null
    const nIssn = normalizeIssn(params.issn)
    const nIssnL = normalizeIssn(params.issnL)
    if (!year) {
      return {
        found: false,
        code: null,
        typeId: null,
        quartile: null,
        needsConfirmation: true,
        reason: 'Thiếu năm xuất bản nên chưa tra được chỉ mục theo năm.',
      }
    }
    if (!nIssn && !nIssnL) {
      return {
        found: false,
        code: null,
        typeId: null,
        quartile: null,
        needsConfirmation: true,
        reason: 'Thiếu ISSN/ISSN-L nên chưa tra được chỉ mục tạp chí.',
      }
    }

    const rows = await JournalIndexEntry.query()
      .where('year', year)
      .andWhere((b) => {
        if (nIssn) b.orWhereRaw("regexp_replace(upper(coalesce(issn, '')), '[^0-9X]', '', 'g') = ?", [nIssn])
        if (nIssnL) b.orWhereRaw("regexp_replace(upper(coalesce(issn_l, '')), '[^0-9X]', '', 'g') = ?", [nIssnL])
      })
      .orderBy('id', 'asc')

    const row = rows[0]
    if (!row) {
      return {
        found: false,
        code: null,
        typeId: null,
        quartile: null,
        needsConfirmation: true,
        reason: 'Không tìm thấy bản ghi chỉ mục tạp chí theo ISSN và năm.',
      }
    }

    const q = row.quartile
    let code: string | null = null
    if (row.inScieSsciAhci) code = quartileToWosCode(q)
    else if (row.inScopus || row.inEsci) code = quartileToScopusCode(q)

    if (!code) {
      return {
        found: true,
        code: null,
        typeId: null,
        quartile: q,
        needsConfirmation: true,
        reason: 'Có dữ liệu chỉ mục nhưng chưa đủ để suy ra nhóm theo 1883.',
      }
    }
    const typeId = await codeToTypeId(code)
    if (!typeId) {
      return {
        found: true,
        code,
        typeId: null,
        quartile: q,
        needsConfirmation: true,
        reason: `Suy ra mã ${code} nhưng chưa tồn tại trong cây research_output_types.`,
      }
    }

    return {
      found: true,
      code,
      typeId,
      quartile: q,
      needsConfirmation: false,
      reason:
        row.inScieSsciAhci
          ? `Tra chỉ mục theo năm: SCIE/SSCI/AHCI, quartile=${q ?? 'NO_Q'}.`
          : `Tra chỉ mục theo năm: Scopus/ESCI, quartile=${q ?? 'NO_Q'}.`,
    }
  }
}
