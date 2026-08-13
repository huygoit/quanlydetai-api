import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung đủ 12 trường thông tin đào tạo trên lý lịch:
 * - Đại học: trường / năm / chuyên ngành / quốc gia
 * - Học vị: (đã có degree, year, country) + chuyên ngành
 * - Học hàm: (đã có title, year) + chuyên ngành / quốc gia
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('undergraduate_institution', 255).nullable()
      table.integer('undergraduate_year').nullable()
      table.string('undergraduate_major', 255).nullable()
      table.string('undergraduate_country', 100).nullable()
      table.string('degree_major', 255).nullable()
      table.string('academic_title_major', 255).nullable()
      table.string('academic_title_country', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('undergraduate_institution')
      table.dropColumn('undergraduate_year')
      table.dropColumn('undergraduate_major')
      table.dropColumn('undergraduate_country')
      table.dropColumn('degree_major')
      table.dropColumn('academic_title_major')
      table.dropColumn('academic_title_country')
    })
  }
}
