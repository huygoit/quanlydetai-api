import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng danh mục đơn vị (department): phẳng, có type phân loại.
 */
export default class extends BaseSchema {
  protected tableName = 'departments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 50).notNullable().unique()
      table.string('name', 255).notNullable()
      table.string('short_name', 100).nullable()
      table.string('type', 50).notNullable()
      table.integer('display_order').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('code')
      table.index('name')
      table.index('type')
      table.index('status')
      table.index('display_order')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
