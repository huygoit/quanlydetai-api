import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'startup_project_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('startup_project_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('startup_projects')
        .onDelete('CASCADE')

      table.string('member_type', 20).notNullable()
      table.bigInteger('student_id').unsigned().nullable().references('id').inTable('students').onDelete('SET NULL')
      table.bigInteger('lecturer_id').unsigned().nullable()
      // Chưa tạo FK cứng vì bảng lecturers có thể chưa tồn tại trong DB hiện tại.
      table.string('role', 20).notNullable().defaultTo('MEMBER')
      table.boolean('is_main').notNullable().defaultTo(false)
      table.date('joined_at').nullable()
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('startup_project_id')
      table.index('member_type')
      table.index('student_id')
      table.index('lecturer_id')
      table.index('role')
    })

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT ${this.tableName}_member_type_check
      CHECK (member_type IN ('STUDENT','LECTURER'))
    `)

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT ${this.tableName}_role_check
      CHECK (role IN ('LEADER','MENTOR','MEMBER'))
    `)

    this.schema.raw(`
      CREATE UNIQUE INDEX startup_project_members_unique_student_per_project
      ON ${this.tableName} (startup_project_id, student_id)
      WHERE student_id IS NOT NULL
    `)

    this.schema.raw(`
      CREATE UNIQUE INDEX startup_project_members_unique_lecturer_per_project
      ON ${this.tableName} (startup_project_id, lecturer_id)
      WHERE lecturer_id IS NOT NULL
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}