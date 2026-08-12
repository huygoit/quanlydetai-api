import { BaseSchema } from '@adonisjs/lucid/schema'

/** Quá trình đào tạo theo bậc + khóa tập huấn/bồi dưỡng (hồ sơ khoa học) */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('scientific_profiles', (table) => {
      table.jsonb('education_records').notNullable().defaultTo('[]')
      table.jsonb('training_courses').notNullable().defaultTo('[]')
    })
  }

  async down() {
    this.schema.alterTable('scientific_profiles', (table) => {
      table.dropColumn('education_records')
      table.dropColumn('training_courses')
    })
  }
}
