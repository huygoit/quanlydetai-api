import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Flow Tổ chức thẩm định:
 * - nhóm nhiều TM / phiên
 * - QĐ → BGH ký → TC-HC phát hành
 * - phiếu BM.05a theo thành viên × TM
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_outline_defense_sessions', (table) => {
      table.string('title', 500).nullable()
      table.text('decision_draft_html').nullable()
      table.string('decision_code', 80).nullable()
      table.string('decision_file_url', 500).nullable()
      table.timestamp('submitted_to_bgh_at', { useTz: true }).nullable()
      table.integer('submitted_to_bgh_by').unsigned().nullable()
      table.timestamp('bgh_signed_at', { useTz: true }).nullable()
      table.integer('bgh_signed_by').unsigned().nullable()
      table.text('bgh_sign_note').nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      table.integer('published_by').unsigned().nullable()
    })

    // Đồng bộ trạng thái cũ CONFIRMED → PUBLISHED (cùng nghĩa đã mời HĐ)
    this.defer(async (db) => {
      await db
        .from('project_outline_defense_sessions')
        .where('status', 'CONFIRMED')
        .update({ status: 'PUBLISHED' })
    })

    this.schema.createTable('project_outline_defense_session_outlines', (table) => {
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
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['session_id', 'project_outline_id'])
      table.index(['project_outline_id'])
    })

    // Backfill: mỗi phiên cũ gắn đúng 1 TM
    this.defer(async (db) => {
      const rows = await db.from('project_outline_defense_sessions').select('id', 'project_outline_id')
      const now = new Date()
      for (const r of rows) {
        await db.table('project_outline_defense_session_outlines').insert({
          session_id: r.id,
          project_outline_id: r.project_outline_id,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        })
      }
    })

    this.schema.createTable('project_outline_defense_score_sheets', (table) => {
      table.increments('id').primary()
      table
        .integer('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outline_defense_sessions')
        .onDelete('CASCADE')
      table
        .integer('member_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outline_defense_members')
        .onDelete('CASCADE')
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      /** DRAFT | SUBMITTED */
      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.boolean('precheck_eligible').nullable()
      table.boolean('precheck_conflict_cleared').nullable()
      table.boolean('precheck_ethics_ok').nullable()
      /** [{ code, name, maxScore, score }] */
      table.text('scores_json').notNullable().defaultTo('[]')
      table.decimal('total_score', 8, 2).nullable()
      /** DE_XUAT | HOAN_THIEN | KHONG_DE_XUAT */
      table.string('conclusion', 40).nullable()
      table.text('general_comment').nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('reminded_at', { useTz: true }).nullable()
      table.integer('reminded_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['session_id', 'member_id', 'project_outline_id'])
      table.index(['member_id', 'status'])
      table.index(['session_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable('project_outline_defense_score_sheets')
    this.schema.dropTable('project_outline_defense_session_outlines')
    this.schema.alterTable('project_outline_defense_sessions', (table) => {
      table.dropColumn('title')
      table.dropColumn('decision_draft_html')
      table.dropColumn('decision_code')
      table.dropColumn('decision_file_url')
      table.dropColumn('submitted_to_bgh_at')
      table.dropColumn('submitted_to_bgh_by')
      table.dropColumn('bgh_signed_at')
      table.dropColumn('bgh_signed_by')
      table.dropColumn('bgh_sign_note')
      table.dropColumn('published_at')
      table.dropColumn('published_by')
    })
  }
}
