import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-03-04: kết quả HĐ trên phiên xét chọn, biên bản, trình BGH, khóa phiên.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('proposal_selection_sessions', (table) => {
      table.string('title', 500).nullable()
      table.jsonb('council_members').notNullable().defaultTo('[]')
      table.text('minutes_html').nullable()
      table.string('minutes_file_url', 500).nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.bigInteger('submitted_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('bgh_reviewed_at', { useTz: true }).nullable()
      table.bigInteger('bgh_reviewed_by').unsigned().nullable().references('id').inTable('users')
      table.text('bgh_comment').nullable()
      table.timestamp('locked_at', { useTz: true }).nullable()
      table.integer('version').notNullable().defaultTo(1)
    })

    this.schema.alterTable('proposal_selection_session_items', (table) => {
      table.text('council_opinion').nullable()
      table.string('council_result', 30).nullable()
      table.text('adjustment_note').nullable()
      table.bigInteger('result_entered_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('result_entered_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('project_proposals', (table) => {
      table.boolean('can_write_outline').notNullable().defaultTo(false)
      table.text('council_adjustment_note').nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('can_write_outline')
      table.dropColumn('council_adjustment_note')
    })
    this.schema.alterTable('proposal_selection_session_items', (table) => {
      table.dropColumn('council_opinion')
      table.dropColumn('council_result')
      table.dropColumn('adjustment_note')
      table.dropColumn('result_entered_by')
      table.dropColumn('result_entered_at')
    })
    this.schema.alterTable('proposal_selection_sessions', (table) => {
      table.dropColumn('title')
      table.dropColumn('council_members')
      table.dropColumn('minutes_html')
      table.dropColumn('minutes_file_url')
      table.dropColumn('submitted_at')
      table.dropColumn('submitted_by')
      table.dropColumn('bgh_reviewed_at')
      table.dropColumn('bgh_reviewed_by')
      table.dropColumn('bgh_comment')
      table.dropColumn('locked_at')
      table.dropColumn('version')
    })
  }
}
