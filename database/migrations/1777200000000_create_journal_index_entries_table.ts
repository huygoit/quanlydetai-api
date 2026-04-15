import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'journal_index_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.integer('year').notNullable()
      table.string('issn', 20).nullable()
      table.string('issn_l', 20).nullable()
      table.string('journal_name', 500).nullable()
      table.boolean('in_scie_ssci_ahci').notNullable().defaultTo(false)
      table.boolean('in_scopus').notNullable().defaultTo(false)
      table.boolean('in_esci').notNullable().defaultTo(false)
      table.string('quartile', 10).nullable()
      table.string('source_provider', 100).nullable()
      table.text('source_note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['year'])
      table.index(['issn'])
      table.index(['issn_l'])
      table.unique(['year', 'issn'])
      table.unique(['year', 'issn_l'])
    })
    this.schema.raw(
      "ALTER TABLE journal_index_entries ADD CONSTRAINT journal_index_entries_quartile_check CHECK (quartile IS NULL OR quartile IN ('Q1','Q2','Q3','Q4','NO_Q'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
