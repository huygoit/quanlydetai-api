import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thêm thuộc tính xác định phạm vi tính hệ số a (QĐ 1883) cho từng leaf.
 * - authors: mục 3 (tính trên toàn bộ tác giả)
 * - chiLienHe: mục 1–2 (tính trên tập tác giả liên hệ; thiếu liên hệ → a=1 theo khoản (c))
 */
export default class extends BaseSchema {
  protected tableName = 'research_output_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('pham_vi_he_so_a_1883', 20)
        .nullable()
        .comment('1883: authors | chiLienHe')
    })
    this.schema.raw(
      "ALTER TABLE research_output_types ADD CONSTRAINT research_output_types_pham_vi_he_so_a_1883_check CHECK (pham_vi_he_so_a_1883 IN ('authors', 'chiLienHe') OR pham_vi_he_so_a_1883 IS NULL)"
    )
    this.schema.raw('CREATE INDEX IF NOT EXISTS idx_research_output_types_a_scope_1883 ON research_output_types (pham_vi_he_so_a_1883)')
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_research_output_types_a_scope_1883')
    this.schema.raw(
      'ALTER TABLE research_output_types DROP CONSTRAINT IF EXISTS research_output_types_pham_vi_he_so_a_1883_check'
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pham_vi_he_so_a_1883')
    })
  }
}

