import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-04: phiên bảo vệ thuyết minh + thành viên hội đồng.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_outline_defense_sessions', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      /** DRAFT | CONFIRMED | CANCELLED | FINALIZED */
      table.string('status', 30).notNullable().defaultTo('DRAFT')
      /** IN_PERSON | ONLINE | HYBRID */
      table.string('meeting_mode', 20).notNullable()
      table.timestamp('meeting_at', { useTz: true }).notNullable()
      table.string('location', 500).nullable()
      table.string('meeting_url', 1000).nullable()
      table.boolean('short_notice_override').notNullable().defaultTo(false)
      table.text('short_notice_reason').nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.text('cancel_reason').nullable()
      table.text('discussion_notes').nullable()
      /** THONG_QUA | THONG_QUA_DIEU_CHINH | KHONG_THONG_QUA */
      table.string('conclusion', 40).nullable()
      table.decimal('final_score', 8, 2).nullable()
      table.text('adjustment_requirements').nullable()
      table.timestamp('adjustment_deadline', { useTz: true }).nullable()
      table.text('minutes_html').nullable()
      table.string('minutes_file_url', 500).nullable()
      table.timestamp('finalized_at', { useTz: true }).nullable()
      table.integer('finalized_by').unsigned().nullable()
      table.integer('created_by').unsigned().notNullable()
      table.integer('version').notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
      table.index(['meeting_at'])
    })

    this.schema.createTable('project_outline_defense_members', (table) => {
      table.increments('id').primary()
      table
        .integer('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outline_defense_sessions')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().nullable()
      table.integer('scientific_profile_id').unsigned().nullable()
      table.string('member_name', 255).notNullable()
      table.string('member_email', 255).nullable()
      /** CHU_TICH | THU_KY | UY_VIEN */
      table.string('role_in_council', 30).notNullable()
      table.boolean('is_external').notNullable().defaultTo(false)
      table.string('unit', 255).nullable()
      table.string('proposed_source_note', 500).nullable()
      /** PENDING | PRESENT | ABSENT */
      table.string('attendance', 20).nullable().defaultTo('PENDING')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['session_id'])
      table.index(['user_id', 'session_id'])
    })

    this.schema.alterTable('project_outlines', (table) => {
      table.integer('active_defense_session_id').unsigned().nullable()
      table.timestamp('defense_scheduled_at', { useTz: true }).nullable()
      table.string('defense_conclusion', 40).nullable()
      table.timestamp('defense_finalized_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('active_defense_session_id')
      table.dropColumn('defense_scheduled_at')
      table.dropColumn('defense_conclusion')
      table.dropColumn('defense_finalized_at')
    })
    this.schema.dropTable('project_outline_defense_members')
    this.schema.dropTable('project_outline_defense_sessions')
  }
}
