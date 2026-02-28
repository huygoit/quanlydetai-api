import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng hồ sơ khoa học (1 user = 1 profile).
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('full_name', 255).notNullable()
      table.date('date_of_birth').nullable()
      table.string('gender', 10).nullable()
      table.string('work_email', 255).notNullable()
      table.string('phone', 20).nullable()
      table.string('orcid', 50).nullable()
      table.text('google_scholar_url').nullable()
      table.string('scopus_id', 50).nullable()
      table.text('research_gate_url').nullable()
      table.text('personal_website').nullable()
      table.text('avatar_url').nullable()
      table.text('bio').nullable()

      table.string('organization', 255).notNullable()
      table.string('faculty', 255).nullable()
      table.string('department', 255).nullable()
      table.string('current_title', 100).nullable()
      table.string('management_role', 100).nullable()
      table.date('start_working_at').nullable()

      table.string('degree', 20).nullable()
      table.string('academic_title', 10).nullable()
      table.integer('degree_year').nullable()
      table.string('degree_institution', 255).nullable()
      table.string('degree_country', 100).nullable()

      table.string('main_research_area', 255).nullable()
      table.jsonb('sub_research_areas').nullable().defaultTo('[]')
      table.jsonb('keywords').nullable().defaultTo('[]')

      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.integer('completeness').notNullable().defaultTo(0)
      table.timestamp('verified_at').nullable()
      table.string('verified_by', 255).nullable()
      table.text('need_more_info_reason').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
