import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung theo user story nộp đề tài (05-nop-detai):
 * - file biểu mẫu, hướng NC, gắn kỳ CFP
 * - bảng audit timeline
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table.string('research_direction', 500).nullable()
      table.string('attachment_url', 500).nullable()
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('SET NULL')
      table.index('call_for_proposal_id')
    })

    this.schema.createTable('project_proposal_audits', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
        .onDelete('CASCADE')
      table.bigInteger('actor_user_id').unsigned().notNullable().references('id').inTable('users')
      table.string('action', 40).notNullable()
      table.string('from_status', 30).nullable()
      table.string('to_status', 30).nullable()
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index('project_proposal_id')
    })
  }

  async down() {
    this.schema.dropTable('project_proposal_audits')
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('research_direction')
      table.dropColumn('attachment_url')
      table.dropColumn('call_for_proposal_id')
    })
  }
}
