import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('needs_index_confirmation').notNullable().defaultTo(false)
      table.string('index_mapped_code', 50).nullable()
      table.text('index_mapping_reason').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('needs_index_confirmation')
      table.dropColumn('index_mapped_code')
      table.dropColumn('index_mapping_reason')
    })
  }
}
