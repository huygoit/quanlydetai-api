import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-05-01: mẫu hợp đồng BM.06 do Admin cấu hình (file DOCX + biến {{...}}).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('contract_templates', (table) => {
      table.increments('id').primary()
      table.string('code', 50).notNullable().unique()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      /** BM06 | khác — hiện chỉ dùng BM06 */
      table.string('form_code', 20).notNullable().defaultTo('BM06')
      table.string('file_name', 255).notNullable()
      table.string('stored_file_name', 255).notNullable()
      table.string('file_url', 500).notNullable()
      table.integer('file_size').unsigned().nullable()
      /** Danh sách biến phát hiện trong DOCX: string[] */
      table.json('detected_variables').nullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      /** ACTIVE | INACTIVE */
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.integer('version').notNullable().defaultTo(1)
      table.integer('uploaded_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['form_code', 'status'])
      table.index(['is_default'])
    })
  }

  async down() {
    this.schema.dropTable('contract_templates')
  }
}
