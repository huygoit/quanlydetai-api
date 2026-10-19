import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cấu hình riêng từng mẫu DOCX (thông báo: ký hiệu, nơi nhận, người ký).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('contract_templates', (table) => {
      table.json('merge_config').nullable()
    })
  }

  async down() {
    this.schema.alterTable('contract_templates', (table) => {
      table.dropColumn('merge_config')
    })
  }
}
