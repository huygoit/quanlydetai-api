import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Đề tài SV NCKH: FK tới staffs (GVHD) và students (thành viên nhóm).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('projects', (table) => {
      table
        .bigInteger('leader_staff_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('staffs')
        .onDelete('SET NULL')
    })

    this.schema.alterTable('project_members', (table) => {
      table
        .bigInteger('student_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('students')
        .onDelete('SET NULL')
      table
        .bigInteger('staff_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('staffs')
        .onDelete('SET NULL')
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX project_members_unique_project_student
      ON project_members (project_id, student_id)
      WHERE student_id IS NOT NULL
    `)
    this.schema.raw(`
      CREATE UNIQUE INDEX project_members_unique_project_staff
      ON project_members (project_id, staff_id)
      WHERE staff_id IS NOT NULL
    `)
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS project_members_unique_project_student`)
    this.schema.raw(`DROP INDEX IF EXISTS project_members_unique_project_staff`)

    this.schema.alterTable('project_members', (table) => {
      table.dropColumn('student_id')
      table.dropColumn('staff_id')
    })
    this.schema.alterTable('projects', (table) => {
      table.dropColumn('leader_staff_id')
    })
  }
}
