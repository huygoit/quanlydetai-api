import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('affiliation_units').notNullable().defaultTo('[]')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('affiliation_units')
    })
  }
}
