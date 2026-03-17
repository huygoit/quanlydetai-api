import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'startup_projects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 100).notNullable().unique()
      table.string('title', 500).notNullable()

      table
        .bigInteger('research_startup_field_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('research_startup_fields')
        .onDelete('SET NULL')
      table
        .bigInteger('academic_year_id')
        .unsigned()
        .nullable()
      // Chưa tạo FK cứng vì bảng academic_years có thể chưa tồn tại trong DB hiện tại.
      table
        .bigInteger('faculty_id')
        .unsigned()
        .nullable()
      // Chưa tạo FK cứng vì bảng faculties có thể chưa tồn tại trong DB hiện tại.
      table
        .bigInteger('department_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      table
        .bigInteger('leader_student_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('students')
        .onDelete('SET NULL')
      table
        .bigInteger('mentor_lecturer_id')
        .unsigned()
        .nullable()
      // Chưa tạo FK cứng vì bảng lecturers có thể chưa tồn tại trong DB hiện tại.

      table.string('status', 30).notNullable().defaultTo('DRAFT')
      table.text('problem_statement').nullable()
      table.text('solution_description').nullable()
      table.text('business_model').nullable()
      table.text('target_customer').nullable()
      table.string('product_stage', 20).nullable()
      table.text('achievement').nullable()
      table.text('award_info').nullable()
      table.text('note').nullable()
      table.date('started_at').nullable()
      table.date('ended_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()

      table.index('status')
      table.index('is_active')
      table.index('research_startup_field_id')
      table.index('academic_year_id')
      table.index('faculty_id')
      table.index('department_id')
      table.index('leader_student_id')
      table.index('mentor_lecturer_id')
    })

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT ${this.tableName}_status_check
      CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','IN_PROGRESS','COMPLETED','AWARDED','REJECTED','CANCELLED'))
    `)

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT ${this.tableName}_product_stage_check
      CHECK (product_stage IS NULL OR product_stage IN ('IDEA','MVP','PILOT','MARKET'))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}