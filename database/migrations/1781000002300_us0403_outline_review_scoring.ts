import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-03: bộ tiêu chí + phiếu chấm phản biện kín.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_review_criteria_sets', (table) => {
      table.increments('id').primary()
      table.string('code', 60).notNullable().unique()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('is_default').notNullable().defaultTo(false)
      /** Ngưỡng điểm trung bình đánh dấu không đạt (TBD nghiệp vụ) */
      table.decimal('fail_threshold', 6, 2).notNullable().defaultTo(50)
      /** PKH không xem điểm từng PB trước khi đủ phiếu */
      table.boolean('blind_aggregation').notNullable().defaultTo(true)
      /** Nhận xét từng tiêu chí bắt buộc ≥ N ký tự (0 = không bắt buộc) */
      table.integer('min_comment_length').notNullable().defaultTo(50)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('project_review_criteria_items', (table) => {
      table.increments('id').primary()
      table
        .integer('criteria_set_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_review_criteria_sets')
        .onDelete('CASCADE')
      table.string('code', 60).notNullable()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.decimal('max_score', 6, 2).notNullable()
      table.decimal('weight', 6, 4).notNullable().defaultTo(1)
      table.integer('sort_order').notNullable().defaultTo(1)
      table.boolean('comment_required').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['criteria_set_id', 'code'])
    })

    this.schema.createTable('project_outline_review_score_sheets', (table) => {
      table.increments('id').primary()
      table
        .integer('assignment_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('project_outline_review_assignments')
        .onDelete('CASCADE')
      table.integer('project_outline_id').unsigned().notNullable()
      table.integer('criteria_set_id').unsigned().nullable()
      /** Snapshot bộ tiêu chí tại thời điểm mở phiếu */
      table.text('criteria_snapshot').notNullable()
      table.string('status', 30).notNullable().defaultTo('DRAFT') // DRAFT | SUBMITTED
      table.decimal('total_score', 8, 2).nullable()
      table.text('general_comment').nullable()
      table.string('conclusion', 40).nullable() // DAT | KHONG_DAT | null
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('reopened_at', { useTz: true }).nullable()
      table.integer('reopened_by').unsigned().nullable()
      table.text('reopen_reason').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
    })

    this.schema.createTable('project_outline_review_score_lines', (table) => {
      table.increments('id').primary()
      table
        .integer('score_sheet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outline_review_score_sheets')
        .onDelete('CASCADE')
      table.string('criterion_code', 60).notNullable()
      table.string('criterion_name', 255).notNullable()
      table.decimal('max_score', 6, 2).notNullable()
      table.decimal('weight', 6, 4).notNullable().defaultTo(1)
      table.integer('sort_order').notNullable().defaultTo(1)
      table.boolean('comment_required').notNullable().defaultTo(true)
      table.decimal('score', 6, 2).nullable()
      table.text('comment').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['score_sheet_id', 'criterion_code'])
    })

    // Tổng hợp trên outline khi đủ phiếu
    this.schema.alterTable('project_outlines', (table) => {
      table.decimal('review_average_score', 8, 2).nullable()
      table.boolean('review_below_threshold').nullable()
      table.timestamp('review_scores_completed_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('review_average_score')
      table.dropColumn('review_below_threshold')
      table.dropColumn('review_scores_completed_at')
    })
    this.schema.dropTable('project_outline_review_score_lines')
    this.schema.dropTable('project_outline_review_score_sheets')
    this.schema.dropTable('project_review_criteria_items')
    this.schema.dropTable('project_review_criteria_sets')
  }
}
