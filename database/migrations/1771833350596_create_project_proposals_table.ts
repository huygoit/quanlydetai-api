import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng đề xuất đề tài (đăng ký đề xuất - giai đoạn 1).
 */
export default class extends BaseSchema {
  protected tableName = 'project_proposals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 20).notNullable().unique()
      table.string('title', 500).notNullable()
      table.string('field', 100).notNullable()
      table.string('level', 20).notNullable()
      table.integer('year').notNullable()
      table.integer('duration_months').notNullable()
      table.jsonb('keywords').nullable().defaultTo('[]')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Chủ nhiệm
      table.bigInteger('owner_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('owner_name', 255).notNullable()
      table.string('owner_email', 255).nullable()
      table.string('owner_unit', 255).notNullable()
      table.jsonb('co_authors').nullable().defaultTo('[]')

      // Nội dung khoa học
      table.text('objectives').notNullable()
      table.text('summary').notNullable()
      table.text('content_outline').nullable()
      table.text('expected_results').nullable()
      table.text('application_potential').nullable()

      // Kinh phí
      table.bigInteger('requested_budget_total').nullable()
      table.text('requested_budget_detail').nullable()

      // Trạng thái
      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.text('unit_comment').nullable()
      table.boolean('unit_approved').nullable()
      table.text('sci_dept_comment').nullable()
      table.string('sci_dept_priority', 10).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
