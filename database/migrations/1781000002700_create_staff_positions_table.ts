import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Danh mục chức vụ nhân sự — 4 loại:
 * MAIN | CONCURRENT | HIGHEST | PARTY
 */
export default class extends BaseSchema {
  protected tableName = 'staff_positions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      // Loại chức vụ: chính / kiêm nhiệm / cao nhất / đảng
      table.string('kind', 30).notNullable()
      table.string('code', 80).notNullable().unique()
      table.string('name', 255).notNullable()
      table.integer('display_order').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('kind')
      table.index('code')
      table.index('name')
      table.index('status')
      table.index('display_order')
      table.index(['kind', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
