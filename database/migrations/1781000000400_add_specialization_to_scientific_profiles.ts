import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Chuyên ngành đào tạo của cán bộ (nguồn: cột nv_chuyennganh trong danh mục nhân sự).
 * Tách riêng với mainResearchArea (lĩnh vực nghiên cứu).
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('specialization', 255).nullable().comment('Chuyên ngành đào tạo')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('specialization')
    })
  }
}
