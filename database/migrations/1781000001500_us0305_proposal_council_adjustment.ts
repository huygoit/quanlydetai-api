import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-03-05: GV điều chỉnh đề xuất theo yêu cầu Hội đồng.
 * - Hạn 5 ngày làm việc + cờ nhắc ngày thứ 4
 * - Bảng version bản gốc / bản sau nộp lại
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table.timestamp('adjustment_notified_at', { useTz: true }).nullable()
      table.timestamp('adjustment_due_at', { useTz: true }).nullable()
      table.boolean('adjustment_overdue').notNullable().defaultTo(false)
      table.timestamp('adjustment_reminder_sent_at', { useTz: true }).nullable()
      table.text('adjustment_explanation').nullable()
    })

    this.schema.createTable('project_proposal_adjustment_versions', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
        .onDelete('CASCADE')
      /** ORIGINAL = trước điều chỉnh; SUBMITTED = sau khi GV nộp lại */
      table.string('version_type', 20).notNullable()
      table.string('title', 500).notNullable()
      table.text('objectives').notNullable()
      table.text('council_adjustment_note').nullable()
      table.text('explanation_note').nullable()
      table.bigInteger('created_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['project_proposal_id', 'version_type'], 'ppav_proposal_type_idx')
    })
  }

  async down() {
    this.schema.dropTable('project_proposal_adjustment_versions')
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('adjustment_notified_at')
      table.dropColumn('adjustment_due_at')
      table.dropColumn('adjustment_overdue')
      table.dropColumn('adjustment_reminder_sent_at')
      table.dropColumn('adjustment_explanation')
    })
  }
}
