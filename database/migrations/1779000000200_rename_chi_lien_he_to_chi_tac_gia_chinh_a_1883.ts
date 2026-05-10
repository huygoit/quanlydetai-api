import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Đổi giá trị enum phạm vi hệ số a: chiLienHe → chiTacGiaChinh
 * (tập dùng để tính a = tác giả đầu ∪ tác giả liên hệ trong hệ thống).
 */
export default class extends BaseSchema {
  protected tableName = 'research_output_types'

  async up() {
    await this.schema.raw(`
      UPDATE research_output_types
      SET pham_vi_he_so_a_1883 = 'chiTacGiaChinh'
      WHERE pham_vi_he_so_a_1883 = 'chiLienHe'
    `)

    await this.schema.raw(`
      ALTER TABLE research_output_types
      DROP CONSTRAINT IF EXISTS research_output_types_pham_vi_he_so_a_1883_check
    `)

    await this.schema.raw(`
      ALTER TABLE research_output_types
      ADD CONSTRAINT research_output_types_pham_vi_he_so_a_1883_check
      CHECK (pham_vi_he_so_a_1883 IN ('authors', 'chiTacGiaChinh') OR pham_vi_he_so_a_1883 IS NULL)
    `)

    await this.schema.raw(`
      COMMENT ON COLUMN research_output_types.pham_vi_he_so_a_1883 IS '1883: authors | chiTacGiaChinh'
    `)
  }

  async down() {
    await this.schema.raw(`
      UPDATE research_output_types
      SET pham_vi_he_so_a_1883 = 'chiLienHe'
      WHERE pham_vi_he_so_a_1883 = 'chiTacGiaChinh'
    `)

    await this.schema.raw(`
      ALTER TABLE research_output_types
      DROP CONSTRAINT IF EXISTS research_output_types_pham_vi_he_so_a_1883_check
    `)

    await this.schema.raw(`
      ALTER TABLE research_output_types
      ADD CONSTRAINT research_output_types_pham_vi_he_so_a_1883_check
      CHECK (pham_vi_he_so_a_1883 IN ('authors', 'chiLienHe') OR pham_vi_he_so_a_1883 IS NULL)
    `)

    await this.schema.raw(`
      COMMENT ON COLUMN research_output_types.pham_vi_he_so_a_1883 IS '1883: authors | chiLienHe'
    `)
  }
}
