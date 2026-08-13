import { BaseSchema } from '@adonisjs/lucid/schema'

/** Quá trình giảng dạy & công tác (JSON nhiều dòng trên hồ sơ). */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    await this.db.rawQuery(`
      ALTER TABLE scientific_profiles
      ADD COLUMN IF NOT EXISTS teaching_work_records jsonb NOT NULL DEFAULT '[]'::jsonb
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE scientific_profiles
      DROP COLUMN IF EXISTS teaching_work_records
    `)
  }
}
