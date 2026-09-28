import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thêm loại mẫu (Hợp đồng / Biên bản thanh lý) — tách khỏi form_code (BM06…).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('contract_templates', (table) => {
      table.string('template_type', 30).notNullable().defaultTo('HOP_DONG')
      table.index(['template_type', 'status'])
      table.index(['template_type', 'is_default'])
    })

    this.defer(async (db) => {
      await db.from('contract_templates').where('form_code', 'BM06').update({
        template_type: 'HOP_DONG',
      })
      await db
        .from('contract_templates')
        .whereIn('form_code', ['THANH_LY', 'BBTL'])
        .update({ template_type: 'THANH_LY' })
    })
  }

  async down() {
    this.schema.alterTable('contract_templates', (table) => {
      table.dropIndex(['template_type', 'status'])
      table.dropIndex(['template_type', 'is_default'])
      table.dropColumn('template_type')
    })
  }
}
