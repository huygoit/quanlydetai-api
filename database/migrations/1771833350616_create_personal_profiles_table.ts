import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng hồ sơ cá nhân (personal_profiles) - thông tin nhân sự nền.
 */
export default class extends BaseSchema {
  protected tableName = 'personal_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').notNullable().unique().unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('staff_code', 50).nullable()
      table.string('full_name', 255).notNullable()
      table.string('gender', 20).nullable()
      table.date('date_of_birth').nullable()
      table.string('place_of_birth', 255).nullable()
      table.string('phone', 50).nullable()
      table.string('personal_email', 255).nullable()
      table.string('work_email', 255).nullable()
      table.text('address').nullable()
      table.bigInteger('department_id').nullable().unsigned().references('id').inTable('departments').onDelete('SET NULL')
      table.string('position_title', 255).nullable()
      table.string('employment_type', 50).nullable()
      table.string('academic_degree', 100).nullable()
      table.string('academic_title', 100).nullable()
      table.string('specialization', 255).nullable()
      table.string('professional_qualification', 255).nullable()
      table.string('identity_number', 50).nullable()
      table.date('identity_issue_date').nullable()
      table.string('identity_issue_place', 255).nullable()
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('user_id')
      table.index('staff_code')
      table.index('department_id')
      table.index('status')
      table.index('full_name')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
