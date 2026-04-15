import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Publication from '#models/publication'
import JournalIndexEntry from '#models/journal_index_entry'

function normalizeIssn(raw: string | null): string | null {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .trim()
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export default class BootstrapJournalIndexFromPublications extends BaseCommand {
  static commandName = 'journal-index:bootstrap-from-publications'
  static description = 'Khởi tạo journal_index_entries từ publications hiện có'
  static options: CommandOptions = { startApp: true }

  async run() {
    const pubs = await Publication.query()
      .whereNotNull('issn')
      .whereNotNull('year')
      .whereIn('rank', ['ISI', 'SCOPUS'])

    let inserted = 0
    let updated = 0
    for (const p of pubs) {
      const year = Number(p.year)
      const issn = normalizeIssn(p.issn)
      if (!year || !issn) continue
      const quartile = p.quartile ? String(p.quartile).toUpperCase() : null
      const existed = await JournalIndexEntry.query().where('year', year).where('issn', issn).first()
      const payload = {
        year,
        issn,
        issnL: issn,
        journalName: p.journalOrConference || null,
        inScieSsciAhci: p.rank === 'ISI',
        inScopus: p.rank === 'SCOPUS' || p.rank === 'ISI',
        inEsci: false,
        quartile:
          quartile === 'Q1' || quartile === 'Q2' || quartile === 'Q3' || quartile === 'Q4' || quartile === 'NO_Q'
            ? quartile
            : null,
        sourceProvider: 'BOOTSTRAP_FROM_PUBLICATIONS',
        sourceNote: `publication_id=${p.id}`,
      } as const

      if (existed) {
        existed.merge(payload)
        await existed.save()
        updated++
      } else {
        await JournalIndexEntry.create(payload)
        inserted++
      }
    }
    this.logger.success(`Bootstrap xong. inserted=${inserted}, updated=${updated}`)
  }
}
