import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng danh mục chuyên ngành (specialization): phẳng.
 */
export default class extends BaseSchema {
  protected tableName = 'specializations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 80).notNullable().unique()
      table.string('name', 255).notNullable()
      table.integer('display_order').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('code')
      table.index('name')
      table.index('status')
      table.index('display_order')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
