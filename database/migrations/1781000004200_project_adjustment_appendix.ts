import { BaseSchema } from '@adonisjs/lucid/schema'

/** File phụ lục DOCX khi BGH duyệt điều chỉnh. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_adjustments', (table) => {
      table.string('appendix_file_url', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_adjustments', (table) => {
      table.dropColumn('appendix_file_url')
    })
  }
}
