import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Module 5–6: trạng thái triển khai, 10 mục chi, sổ, ký hợp đồng,
 * tạm ứng, mua sắm, báo cáo, điều chỉnh, đánh giá cuối kỳ.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_outlines', (table) => {
      table.string('execution_status', 40).nullable()
      table.integer('extension_count').notNullable().defaultTo(0)
    })

    this.schema.alterTable('project_contracts', (table) => {
      table.string('external_contract_no', 100).nullable()
      table.string('external_agency', 255).nullable()
      table.string('external_file_url', 500).nullable()
      table.text('return_reason').nullable()
      table.timestamp('cnnv_confirmed_at', { useTz: true }).nullable()
      table.integer('cnnv_confirmed_by').unsigned().nullable()
      table.timestamp('bgh_signed_at', { useTz: true }).nullable()
      table.integer('bgh_signed_by').unsigned().nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      table.integer('published_by').unsigned().nullable()
      table.string('issue_no', 100).nullable()
      table.timestamp('cnnv_signed_at', { useTz: true }).nullable()
      table.integer('cnnv_signed_by').unsigned().nullable()
      table.string('signed_file_url', 500).nullable()
      table.timestamp('effective_at', { useTz: true }).nullable()
    })

    await this.db.rawQuery(`
      UPDATE project_contracts
      SET status = 'HOP_DONG_DA_KY'
      WHERE status = 'DANG_THUC_HIEN'
    `)

    this.schema.alterTable('scientific_profiles', (table) => {
      table.json('completed_research_tasks').nullable()
    })

    this.schema.createTable('project_budget_lines', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('code', 10).notNullable()
      table.decimal('amount', 18, 0).notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_outline_id', 'code'])
    })

    this.schema.createTable('project_budget_entries', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('line_code', 10).notNullable()
      /** ADVANCE | SPENT | SETTLED */
      table.string('entry_type', 20).notNullable()
      table.decimal('amount', 18, 0).notNullable()
      /** YCKT | MS | QT */
      table.string('source_type', 10).notNullable()
      table.integer('source_id').unsigned().notNullable()
      table.text('note').nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'line_code'])
    })

    this.schema.createTable('project_progress_periods', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('title', 500).notNullable()
      table.date('due_on').notNullable()
      /** MILESTONE | MIDPOINT */
      table.string('kind', 20).notNullable()
      table.integer('source_index').nullable()
      table.json('reminded_days').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'due_on'])
    })

    this.schema.createTable('project_progress_reports', (table) => {
      table.increments('id').primary()
      table
        .integer('period_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_progress_periods')
        .onDelete('CASCADE')
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('status', 30).notNullable().defaultTo('BCTD_DRAFT')
      table.json('content_rows').nullable()
      table.json('product_rows').nullable()
      table.text('next_plan').nullable()
      table.text('recommendation').nullable()
      table.json('attachments').nullable()
      table.integer('version').notNullable().defaultTo(1)
      table.text('pkh_note').nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['period_id'])
    })

    this.schema.createTable('project_adjustments', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('status', 30).notNullable().defaultTo('DC_DRAFT')
      table.text('reason').notNullable()
      table.string('evidence_url', 500).nullable()
      table.json('changes').nullable()
      table.boolean('lead_confirmed').notNullable().defaultTo(false)
      table.integer('lead_confirmed_by').unsigned().nullable()
      table.text('decision_note').nullable()
      table.json('applied_diff').nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
    })

    this.schema.createTable('project_payment_requests', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      /** TAM_UNG | THANH_TOAN */
      table.string('kind', 20).notNullable()
      table.string('line_code', 10).notNullable()
      table.decimal('amount', 18, 0).notNullable()
      table.text('detail').nullable()
      table.string('bank_account', 50).nullable()
      table.string('bank_name', 255).nullable()
      table.json('attachments').nullable()
      table.string('status', 30).notNullable().defaultTo('YCKT_DRAFT')
      table.boolean('over_budget').notNullable().defaultTo(false)
      table.text('return_reason').nullable()
      table.string('voucher_no', 100).nullable()
      table.date('voucher_date').nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
    })

    this.schema.createTable('project_procurements', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('kind', 30).notNullable()
      table.string('line_code', 10).notNullable()
      table.text('purpose').nullable()
      table.date('needed_by').nullable()
      table.json('items').nullable()
      table.json('attachments').nullable()
      table.decimal('total_amount', 18, 0).notNullable().defaultTo(0)
      table.string('status', 30).notNullable().defaultTo('MS_DRAFT')
      table.boolean('over_budget').notNullable().defaultTo(false)
      table.text('over_budget_note').nullable()
      table.string('csvc_method', 20).nullable()
      table.timestamp('supplied_at', { useTz: true }).nullable()
      table.timestamp('received_at', { useTz: true }).nullable()
      table.string('voucher_no', 100).nullable()
      table.date('voucher_date').nullable()
      table.text('return_reason').nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
    })

    this.schema.createTable('project_assets', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.integer('procurement_id').unsigned().nullable()
      table.string('name', 500).notNullable()
      table.string('quantity', 50).nullable()
      table.decimal('amount', 18, 0).notNullable().defaultTo(0)
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('project_final_cases', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.timestamp('notified_at', { useTz: true }).nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.json('summary_file').nullable()
      table.json('brief_file').nullable()
      table.boolean('brief_pages_ok').notNullable().defaultTo(false)
      table.text('result_vi').nullable()
      table.text('result_en').nullable()
      table.json('products').nullable()
      table.json('council_file').nullable()
      table.text('publications_note').nullable()
      table.text('pkh_note').nullable()
      table.timestamp('meeting_at', { useTz: true }).nullable()
      table.string('meeting_location', 255).nullable()
      table.timestamp('review_deadline', { useTz: true }).nullable()
      table.json('council_members').nullable()
      table.json('minutes').nullable()
      table.boolean('minutes_locked').notNullable().defaultTo(false)
      table.string('minutes_file_name', 255).nullable()
      table.string('minutes_stored_file_name', 255).nullable()
      table.string('minutes_file_url', 500).nullable()
      table.string('classification', 30).nullable()
      table.json('explanation_items').nullable()
      table.string('explanation_status', 30).nullable()
      table.timestamp('explanation_deadline', { useTz: true }).nullable()
      table.timestamp('explanation_started_at', { useTz: true }).nullable()
      table.json('explanation_report_file').nullable()
      table.text('explanation_return_reason').nullable()
      table.boolean('reminded_day10').notNullable().defaultTo(false)
      table.boolean('reminded_day13').notNullable().defaultTo(false)
      table.timestamp('secretary_confirmed_at', { useTz: true }).nullable()
      table.timestamp('chair_confirmed_at', { useTz: true }).nullable()
      table.string('settlement_status', 30).nullable()
      table.json('settlement_lines').nullable()
      table.json('settlement_files').nullable()
      table.boolean('variance_ack').notNullable().defaultTo(false)
      table.text('variance_reason').nullable()
      table.date('settlement_date').nullable()
      table.text('settlement_return_reason').nullable()
      table.string('liquidation_status', 30).nullable()
      table.string('surplus_handling', 30).nullable()
      table.string('recognition_file_url', 500).nullable()
      table.string('liquidation_file_name', 255).nullable()
      table.string('liquidation_stored_file_name', 255).nullable()
      table.string('liquidation_file_url', 500).nullable()
      table.text('liquidation_return_reason').nullable()
      table.timestamp('liq_bgh_signed_at', { useTz: true }).nullable()
      table.timestamp('liq_published_at', { useTz: true }).nullable()
      table.string('liq_issue_no', 100).nullable()
      table.timestamp('liq_cnnv_signed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_outline_id'])
    })

    this.schema.createTable('project_final_sheets', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable()
      table.json('product_rows').nullable()
      table.text('volume_comment').nullable()
      table.text('quality_comment').nullable()
      table.text('report_comment').nullable()
      table.text('general_comment').nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_outline_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable('project_final_sheets')
    this.schema.dropTable('project_final_cases')
    this.schema.dropTable('project_assets')
    this.schema.dropTable('project_procurements')
    this.schema.dropTable('project_payment_requests')
    this.schema.dropTable('project_adjustments')
    this.schema.dropTable('project_progress_reports')
    this.schema.dropTable('project_progress_periods')
    this.schema.dropTable('project_budget_entries')
    this.schema.dropTable('project_budget_lines')
    this.schema.alterTable('scientific_profiles', (table) => {
      table.dropColumn('completed_research_tasks')
    })
    this.schema.alterTable('project_contracts', (table) => {
      table.dropColumns(
        'external_contract_no',
        'external_agency',
        'external_file_url',
        'return_reason',
        'cnnv_confirmed_at',
        'cnnv_confirmed_by',
        'bgh_signed_at',
        'bgh_signed_by',
        'published_at',
        'published_by',
        'issue_no',
        'cnnv_signed_at',
        'cnnv_signed_by',
        'signed_file_url',
        'effective_at'
      )
    })
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumns('execution_status', 'extension_count')
    })
  }
}
