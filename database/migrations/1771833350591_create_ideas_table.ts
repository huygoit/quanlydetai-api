import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng ý tưởng (ngân hàng ý tưởng).
 */
export default class extends BaseSchema {
  protected tableName = 'ideas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 20).notNullable().unique()
      table.string('title', 500).notNullable()
      table.text('summary').notNullable()
      table.string('field', 100).notNullable()
      table.jsonb('suitable_levels').nullable().defaultTo('[]')

      table.bigInteger('owner_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('owner_name', 255).notNullable()
      table.string('owner_unit', 255).notNullable()

      table.string('status', 30).notNullable().defaultTo('DRAFT')
      table.string('priority', 10).nullable()
      table.text('note_for_review').nullable()

      table.string('rejected_stage', 30).nullable()
      table.text('rejected_reason').nullable()
      table.string('rejected_by_role', 20).nullable()
      table.timestamp('rejected_at').nullable()

      table.string('linked_project_id', 50).nullable()

      table.bigInteger('council_session_id').unsigned().nullable()
      table.decimal('council_avg_weighted_score', 4, 2).nullable()
      table.decimal('council_avg_novelty_score', 4, 2).nullable()
      table.decimal('council_avg_feasibility_score', 4, 2).nullable()
      table.decimal('council_avg_alignment_score', 4, 2).nullable()
      table.decimal('council_avg_author_capacity_score', 4, 2).nullable()
      table.integer('council_submitted_count').nullable()
      table.integer('council_member_count').nullable()
      table.string('council_recommendation', 20).nullable()
      table.timestamp('council_scored_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
