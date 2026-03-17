import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'projects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 50).notNullable().unique()
      table.string('title', 500).notNullable()

      table.bigInteger('proposal_id').unsigned().nullable().references('id').inTable('project_proposals').onDelete('SET NULL')

      table.string('field', 255).nullable()
      table.string('level', 100).nullable()
      table.string('academic_year', 50).nullable()
      table.integer('year').nullable()

      table.bigInteger('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL')

      table.bigInteger('leader_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('leader_name', 255).nullable()
      table.string('leader_unit', 255).nullable()

      table.text('keywords').nullable()
      table.text('objectives').nullable()
      table.text('summary').nullable()
      table.text('content_outline').nullable()
      table.text('expected_results').nullable()
      table.text('application_potential').nullable()

      table.decimal('budget_total', 14, 2).nullable()
      table.text('budget_detail').nullable()

      table.date('start_date').nullable()
      table.date('end_date').nullable()
      table.integer('duration_months').nullable()

      table.string('status', 50).notNullable().defaultTo('DRAFT')
      table.string('approval_status', 50).nullable()

      table.string('acceptance_grade', 50).nullable()
      table.decimal('score', 8, 2).nullable()
      table.decimal('c_factor', 10, 2).nullable()

      table.text('note').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()

      table.index('title')
      table.index('status')
      table.index('academic_year')
      table.index('year')
      table.index('department_id')
      table.index('leader_user_id')
      table.index('proposal_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}