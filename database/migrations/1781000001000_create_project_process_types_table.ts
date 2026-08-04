import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Danh mục Loại quy trình đề tài (QT-I … QT-V)
 */
export default class extends BaseSchema {
  protected tableName = 'project_process_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 30).notNullable().unique()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.integer('display_order').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('status')
      table.index('display_order')
      table.index('name')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
