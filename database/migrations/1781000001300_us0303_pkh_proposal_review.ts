import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-03-03: chuẩn hoá status PKH + cột yêu cầu bổ sung + email_logs stub + phiên xét chọn.
 */
export default class extends BaseSchema {
  async up() {
    // Cột bổ sung trên đề xuất
    this.schema.alterTable('project_proposals', (table) => {
      table.timestamp('supplement_due_at', { useTz: true }).nullable()
      table.boolean('supplement_overdue').notNullable().defaultTo(false)
      table.text('pkh_comment').nullable()
    })

    // Map dữ liệu status cũ → mã US-03-03
    this.defer(async (db) => {
      await db.from('project_proposals').where('status', 'UNIT_REVIEWED').update({ status: 'CHO_PKH' })
      // APPROVED từ sơ duyệt PKH cũ = hợp lệ trình HĐ
      await db.from('project_proposals').where('status', 'APPROVED').update({ status: 'HOP_LE' })
      await db.from('project_proposals').where('status', 'REJECTED').update({ status: 'DA_LOAI' })
    })

    // Log email stub (chưa SMTP)
    this.schema.createTable('email_logs', (table) => {
      table.bigIncrements('id').primary()
      table.string('to_email', 255).notNullable()
      table.string('subject', 500).notNullable()
      table.text('body').notNullable()
      table.string('related_type', 50).nullable()
      table.bigInteger('related_id').unsigned().nullable()
      table.string('status', 20).notNullable().defaultTo('STUB')
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.index(['related_type', 'related_id'])
    })

    // Phiên xét chọn đề tài (MVP)
    this.schema.createTable('proposal_selection_sessions', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('RESTRICT')
      table.timestamp('meeting_at', { useTz: true }).notNullable()
      table.string('location', 500).notNullable()
      table.bigInteger('created_by').unsigned().notNullable().references('id').inTable('users')
      table.boolean('force_confirmed').notNullable().defaultTo(false)
      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.index('call_for_proposal_id')
    })

    this.schema.createTable('proposal_selection_session_items', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('proposal_selection_sessions')
        .onDelete('CASCADE')
      table
        .bigInteger('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.unique(['session_id', 'project_proposal_id'])
    })
  }

  async down() {
    this.schema.dropTable('proposal_selection_session_items')
    this.schema.dropTable('proposal_selection_sessions')
    this.schema.dropTable('email_logs')

    this.defer(async (db) => {
      await db.from('project_proposals').where('status', 'CHO_PKH').update({ status: 'UNIT_REVIEWED' })
      await db.from('project_proposals').where('status', 'HOP_LE').update({ status: 'APPROVED' })
      await db.from('project_proposals').where('status', 'DA_LOAI').update({ status: 'REJECTED' })
      await db.from('project_proposals').where('status', 'YEU_CAU_BS').update({ status: 'UNIT_REVIEWED' })
    })

    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('supplement_due_at')
      table.dropColumn('supplement_overdue')
      table.dropColumn('pkh_comment')
    })
  }
}
