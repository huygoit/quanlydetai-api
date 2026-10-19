import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hồ sơ đăng ký: chờ đơn vị xác nhận, rồi mới sang PKH.
 * Trả lại thì về nháp.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      'ALTER TABLE proposal_registrations DROP CONSTRAINT IF EXISTS proposal_registrations_status_check'
    )
    this.schema.raw(
      "UPDATE proposal_registrations SET status = 'CHO_DON_VI' WHERE status = 'SUBMITTED'"
    )
    this.schema.alterTable('proposal_registrations', (table) => {
      table.text('unit_comment').nullable()
    })
    this.schema.raw(
      "ALTER TABLE proposal_registrations ADD CONSTRAINT proposal_registrations_status_check CHECK (status IN ('DRAFT','CHO_DON_VI','CHO_PKH'))"
    )
  }

  async down() {
    this.schema.raw(
      'ALTER TABLE proposal_registrations DROP CONSTRAINT IF EXISTS proposal_registrations_status_check'
    )
    this.schema.raw(
      "UPDATE proposal_registrations SET status = 'SUBMITTED' WHERE status IN ('CHO_DON_VI','CHO_PKH')"
    )
    this.schema.alterTable('proposal_registrations', (table) => {
      table.dropColumn('unit_comment')
    })
    this.schema.raw(
      "ALTER TABLE proposal_registrations ADD CONSTRAINT proposal_registrations_status_check CHECK (status IN ('DRAFT','SUBMITTED'))"
    )
  }
}
