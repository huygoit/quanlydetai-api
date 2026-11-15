import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bỏ hợp đồng ngoài — form dự thảo chỉ giữ nội dung HĐ chuẩn BM-02.14.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_contracts', (table) => {
      table.dropColumn('external_contract_no')
      table.dropColumn('external_agency')
      table.dropColumn('external_file_url')
    })
  }

  async down() {
    this.schema.alterTable('project_contracts', (table) => {
      table.string('external_contract_no', 100).nullable()
      table.string('external_agency', 255).nullable()
      table.string('external_file_url', 500).nullable()
    })
  }
}
