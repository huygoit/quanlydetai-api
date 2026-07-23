import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thông báo tuyển chọn đề tài (CFP) + kỳ tiếp nhận 1–1 + audit + job email.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('call_for_proposals', (table) => {
      table.bigIncrements('id').primary()
      table.string('title', 500).notNullable()
      table.string('period_kind', 20).notNullable() // ACADEMIC | FINANCIAL
      table.string('period_label', 30).notNullable()
      table.timestamp('deadline_at', { useTz: true }).notNullable()
      table.jsonb('levels').notNullable().defaultTo('[]')
      table.text('content_html').nullable()
      table.jsonb('attachment_urls').notNullable().defaultTo('[]')
      table.string('status', 30).notNullable().defaultTo('DRAFT')
      table
        .bigInteger('created_by')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table
        .bigInteger('approved_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('approved_at', { useTz: true }).nullable()
      table.text('return_reason').nullable()
      table
        .bigInteger('published_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('published_at', { useTz: true }).nullable()
      table.string('official_doc_no', 100).nullable()
      table.date('official_doc_date').nullable()
      table.string('signed_file_url', 500).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('status')
      table.index('period_label')
      table.index('created_by')
      table.index('deadline_at')
    })

    this.schema.createTable('submission_periods', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('CASCADE')
      table.timestamp('deadline_at', { useTz: true }).notNullable()
      table.string('status', 20).notNullable().defaultTo('OPEN') // OPEN | CLOSED
      table.timestamp('closed_at', { useTz: true }).nullable()
      table
        .bigInteger('closed_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('status')
      table.index('deadline_at')
    })

    this.schema.createTable('call_for_proposal_audits', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('CASCADE')
      table
        .bigInteger('actor_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.string('action', 30).notNullable()
      table.text('note').nullable()
      table.jsonb('diff_json').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index('call_for_proposal_id')
      table.index('action')
    })

    this.schema.createTable('cfp_email_jobs', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('CASCADE')
      table.string('status', 20).notNullable().defaultTo('PENDING')
      table.integer('total').notNullable().defaultTo(0)
      table.integer('sent').notNullable().defaultTo(0)
      table.text('error').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('call_for_proposal_id')
      table.index('status')
    })
  }

  async down() {
    this.schema.dropTable('cfp_email_jobs')
    this.schema.dropTable('call_for_proposal_audits')
    this.schema.dropTable('submission_periods')
    this.schema.dropTable('call_for_proposals')
  }
}
