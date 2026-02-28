import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung cột phục vụ KPI: academic_year, acceptance_grade, c_factor.
 */
export default class extends BaseSchema {
  protected tableName = 'project_proposals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('academic_year', 9).nullable()
      table.string('acceptance_grade', 20).nullable()
      table.decimal('c_factor', 3, 1).nullable()
    })
    this.schema.raw(
      "ALTER TABLE project_proposals ADD CONSTRAINT project_proposals_acceptance_grade_check CHECK (acceptance_grade IS NULL OR acceptance_grade IN ('EXCELLENT','PASS_ON_TIME','PASS_LATE'))"
    )
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('academic_year')
      table.dropColumn('acceptance_grade')
      table.dropColumn('c_factor')
    })
    this.schema.raw('ALTER TABLE project_proposals DROP CONSTRAINT IF EXISTS project_proposals_acceptance_grade_check')
  }
}
