import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type JournalQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NO_Q'

export default class JournalIndexEntry extends BaseModel {
  static table = 'journal_index_entries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare year: number

  @column()
  declare issn: string | null

  @column()
  declare issnL: string | null

  @column()
  declare journalName: string | null

  @column()
  declare inScieSsciAhci: boolean

  @column()
  declare inScopus: boolean

  @column()
  declare inEsci: boolean

  @column()
  declare quartile: JournalQuartile | null

  @column()
  declare sourceProvider: string | null

  @column()
  declare sourceNote: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
