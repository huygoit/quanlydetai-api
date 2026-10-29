import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Phê duyệt cuối US-04: BGH ký → HC phát hành QĐ giao thực hiện.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_outlines', (table) => {
      table.text('bgh_decision_note').nullable()
      table.timestamp('bgh_signed_at', { useTz: true }).nullable()
      table.integer('bgh_signed_by').unsigned().nullable()
      table.text('bgh_reject_reason').nullable()
      table.string('assignment_decision_url', 500).nullable()
      table.timestamp('hc_published_at', { useTz: true }).nullable()
      table.integer('hc_published_by').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumns(
        'bgh_decision_note',
        'bgh_signed_at',
        'bgh_signed_by',
        'bgh_reject_reason',
        'assignment_decision_url',
        'hc_published_at',
        'hc_published_by'
      )
    })
  }
}
