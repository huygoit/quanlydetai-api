import { BaseSchema } from '@adonisjs/lucid/schema'

/** Thêm quốc gia (FK danh mục countries) cho trường ĐH — mặc định Việt Nam. */
export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      ALTER TABLE universities
      ADD COLUMN IF NOT EXISTS country_id BIGINT NULL
        REFERENCES countries(id) ON DELETE SET NULL
    `)
    await this.db.rawQuery(`
      CREATE INDEX IF NOT EXISTS universities_country_id_index ON universities (country_id)
    `)
    // Gán mặc định Việt Nam cho bản ghi hiện có
    await this.db.rawQuery(`
      UPDATE universities u
      SET country_id = c.id
      FROM countries c
      WHERE c.code = 'VN'
        AND u.country_id IS NULL
    `)
  }

  async down() {
    await this.db.rawQuery(`DROP INDEX IF EXISTS universities_country_id_index`)
    await this.db.rawQuery(`
      ALTER TABLE universities DROP COLUMN IF EXISTS country_id
    `)
  }
}
