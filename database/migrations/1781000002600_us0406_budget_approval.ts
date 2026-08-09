import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-06: xác nhận kinh phí (PKH→TC) + phê duyệt LĐ.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_outline_budget_confirmations', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      /**
       * DRAFT | SENT_TO_TC | RETURNED_BY_TC | CONFIRMED | LD_APPROVED | LD_REJECTED | LD_RETURNED
       */
      table.string('status', 30).notNullable().defaultTo('DRAFT')
      table.decimal('requested_budget_snapshot', 18, 2).notNullable().defaultTo(0)
      table.decimal('pkh_proposed_budget', 18, 2).nullable()
      table.text('pkh_note').nullable()
      table.integer('pkh_proposed_by').unsigned().nullable()
      table.timestamp('pkh_proposed_at', { useTz: true }).nullable()
      table.decimal('tc_confirmed_budget', 18, 2).nullable()
      table.text('tc_note').nullable()
      table.boolean('tc_adjusted').notNullable().defaultTo(false)
      table.integer('tc_by').unsigned().nullable()
      table.timestamp('tc_at', { useTz: true }).nullable()
      table.text('tc_return_reason').nullable()
      /** Ngưỡng KP lớn — cần bước HĐ xét duyệt KP tăng cường */
      table.boolean('requires_large_budget_council').notNullable().defaultTo(false)
      table.boolean('large_budget_council_done').notNullable().defaultTo(false)
      table.text('large_budget_council_note').nullable()
      table.string('large_budget_minutes_url', 500).nullable()
      /** APPROVE | REJECT | RETURN */
      table.string('ld_decision', 20).nullable()
      table.text('ld_note').nullable()
      table.text('ld_reject_reason').nullable()
      table.integer('ld_by').unsigned().nullable()
      table.timestamp('ld_at', { useTz: true }).nullable()
      table.decimal('approved_budget', 18, 2).nullable()
      table.timestamp('module5_opened_at', { useTz: true }).nullable()
      table.integer('version').notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id', 'status'])
    })

    this.schema.alterTable('project_outlines', (table) => {
      table.integer('active_budget_confirmation_id').unsigned().nullable()
      table.decimal('confirmed_budget', 18, 2).nullable()
      table.decimal('approved_budget', 18, 2).nullable()
      table.timestamp('module5_opened_at', { useTz: true }).nullable()
      table.boolean('module5_opened').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('active_budget_confirmation_id')
      table.dropColumn('confirmed_budget')
      table.dropColumn('approved_budget')
      table.dropColumn('module5_opened_at')
      table.dropColumn('module5_opened')
    })
    this.schema.dropTable('project_outline_budget_confirmations')
  }
}
