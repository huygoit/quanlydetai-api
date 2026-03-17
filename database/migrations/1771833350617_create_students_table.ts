import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng sinh viên (students) - import từ Excel SinhVien / DonVi_Nganh.
 */
export default class extends BaseSchema {
  protected tableName = 'students'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('student_code', 50).notNullable().unique()
      table.string('first_name', 255).nullable()
      table.string('last_name', 255).nullable()
      table.string('full_name', 255).nullable()
      table.string('gender', 20).nullable()
      table.date('date_of_birth').nullable()
      table.string('place_of_birth', 255).nullable()
      table.string('class_code', 50).nullable()
      table.string('class_name', 255).nullable()
      table.string('course_name', 255).nullable()
      table.string('status', 100).nullable()
      table.string('major_code_raw', 255).nullable()
      table.string('major_name', 255).nullable()
      table.bigInteger('department_id').nullable().unsigned().references('id').inTable('departments').onDelete('SET NULL')
      table.string('personal_email', 255).nullable()
      table.string('school_email', 255).nullable()
      table.string('phone', 50).nullable()
      table.string('identity_card_number', 50).nullable()
      table.string('identity_card_issue_place', 255).nullable()
      table.date('identity_card_issue_date').nullable()
      table.string('ethnicity', 100).nullable()
      table.text('permanent_address').nullable()
      table.text('contact_address').nullable()
      table.text('temporary_address').nullable()
      table.text('note').nullable()
      table.jsonb('source_data').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('student_code')
      table.index('department_id')
      table.index('major_name')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
