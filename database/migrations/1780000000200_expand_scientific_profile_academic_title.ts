import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mở rộng academic_title để lưu key tiếng Anh (vd. ASSOCIATE_PROFESSOR).
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('academic_title', 32).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('academic_title', 10).nullable().alter()
    })
  }
}
