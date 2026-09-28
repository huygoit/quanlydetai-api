import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-05-01 bước 1: dự thảo hợp đồng BM.06 sinh từ mẫu Admin.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_contracts', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table
        .integer('contract_template_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('contract_templates')
        .onDelete('SET NULL')
      /** HOP_DONG_DRAFT | HOP_DONG_CHO_KY | HOP_DONG_DA_KY | … */
      table.string('status', 30).notNullable().defaultTo('HOP_DONG_DRAFT')
      table.string('contract_no', 100).nullable()
      table.string('file_name', 255).notNullable()
      table.string('stored_file_name', 255).notNullable()
      table.string('file_url', 500).notNullable()
      table.integer('file_size').unsigned().nullable()
      table.json('merge_payload').nullable()
      table.integer('version').notNullable().defaultTo(1)
      table.integer('generated_by').unsigned().nullable()
      table.timestamp('generated_at', { useTz: true }).nullable()
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_outline_id'])
      table.index(['status'])
    })

    this.schema.alterTable('project_outlines', (table) => {
      table.integer('active_contract_id').unsigned().nullable()
      table.string('contract_status', 30).nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('active_contract_id')
      table.dropColumn('contract_status')
    })
    this.schema.dropTable('project_contracts')
  }
}
