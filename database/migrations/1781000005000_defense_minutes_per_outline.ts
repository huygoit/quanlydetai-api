import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Biên bản thẩm định BM-02.10 / BM.05b — kết luận theo từng TM trong phiên.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_outline_defense_sessions', (table) => {
      table.integer('total_ballots').nullable()
      table.integer('valid_ballots').nullable()
      table.integer('invalid_ballots').nullable()
      table.text('recommendations').nullable() // mục 6. Kiến nghị
      table.text('minutes_locked_reason').nullable()
      table.timestamp('minutes_reopened_at', { useTz: true }).nullable()
      table.integer('minutes_reopened_by').unsigned().nullable()
    })

    this.schema.createTable('project_outline_defense_minutes_items', (table) => {
      table.increments('id').primary()
      table
        .integer('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outline_defense_sessions')
        .onDelete('CASCADE')
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      /** Điểm TB từ phiếu BM.05a hợp lệ (đã nộp) */
      table.decimal('average_score', 8, 2).nullable()
      table.integer('valid_sheet_count').notNullable().defaultTo(0)
      table.integer('invalid_sheet_count').notNullable().defaultTo(0)
      /**
       * Kết luận HĐ theo mẫu:
       * DE_XUAT_XET | GIAO_TRUC_TIEP | HOAN_THIEN | KHONG_DE_XUAT
       */
      table.string('council_conclusion', 40).nullable()
      table.text('execution_content').nullable() // nội dung thực hiện (thời gian/SP/KP)
      table.text('adjustment_requirements').nullable()
      table.timestamp('adjustment_deadline', { useTz: true }).nullable()
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['session_id', 'project_outline_id'])
    })
  }

  async down() {
    this.schema.dropTable('project_outline_defense_minutes_items')
    this.schema.alterTable('project_outline_defense_sessions', (table) => {
      table.dropColumn('total_ballots')
      table.dropColumn('valid_ballots')
      table.dropColumn('invalid_ballots')
      table.dropColumn('recommendations')
      table.dropColumn('minutes_locked_reason')
      table.dropColumn('minutes_reopened_at')
      table.dropColumn('minutes_reopened_by')
    })
  }
}
