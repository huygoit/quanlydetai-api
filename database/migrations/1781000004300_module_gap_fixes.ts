import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bù các khoảng trống đã chốt từ user story:
 * cổng xác nhận bản hoàn thiện, kỳ không bắt buộc khoa, cách ký hợp đồng.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_outlines', (table) => {
      table.string('revision_gate_status', 20).nullable()
      table.text('revision_return_reason').nullable()
    })

    this.schema.alterTable('call_for_proposals', (table) => {
      table.boolean('require_unit_review').notNullable().defaultTo(true)
    })

    this.schema.alterTable('project_contracts', (table) => {
      table.string('sign_mode', 10).notNullable().defaultTo('ONLINE')
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumns('revision_gate_status', 'revision_return_reason')
    })
    this.schema.alterTable('call_for_proposals', (table) => {
      table.dropColumn('require_unit_review')
    })
    this.schema.alterTable('project_contracts', (table) => {
      table.dropColumn('sign_mode')
    })
  }
}
