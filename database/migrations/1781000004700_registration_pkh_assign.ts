import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Phòng KH chấp thuận một đơn, từ chối các đơn còn lại, rồi phân công nhiệm vụ chính thức.
 * Danh mục không tuyển được ai thì đóng đăng ký kèm ghi chú.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      'ALTER TABLE proposal_registrations ALTER COLUMN status TYPE varchar(40)'
    )
    this.schema.raw(
      'ALTER TABLE proposal_registrations DROP CONSTRAINT IF EXISTS proposal_registrations_status_check'
    )
    this.schema.alterTable('proposal_registrations', (table) => {
      table.text('pkh_reason').nullable()
    })
    this.schema.raw(
      "ALTER TABLE proposal_registrations ADD CONSTRAINT proposal_registrations_status_check CHECK (status IN ('DRAFT','CHO_DON_VI','CHO_PKH','DKDT_DUOC_CHAP_THUAN','DKDT_TU_CHOI'))"
    )

    this.schema.alterTable('project_proposals', (table) => {
      table.string('catalog_registration_status', 30).nullable()
      table.text('catalog_registration_note').nullable()
    })

    this.schema.createTable('official_assignments', (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 30).notNullable().unique()
      table
        .bigInteger('danh_muc_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('project_proposals')
        .onDelete('CASCADE')
      table
        .bigInteger('dang_ky_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('proposal_registrations')
        .onDelete('CASCADE')
      table
        .bigInteger('idea_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ideas')
        .onDelete('SET NULL')
      table
        .bigInteger('principal_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
      table.string('principal_name', 255).notNullable()
      table.string('status', 20).notNullable().defaultTo('DUOC_GIAO')
      table
        .bigInteger('outline_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('SET NULL')
      table
        .bigInteger('created_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('official_assignments')
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('catalog_registration_status')
      table.dropColumn('catalog_registration_note')
    })
    this.schema.raw(
      'ALTER TABLE proposal_registrations DROP CONSTRAINT IF EXISTS proposal_registrations_status_check'
    )
    this.schema.alterTable('proposal_registrations', (table) => {
      table.dropColumn('pkh_reason')
    })
    this.schema.raw(
      "UPDATE proposal_registrations SET status = 'CHO_PKH' WHERE status IN ('DKDT_DUOC_CHAP_THUAN','DKDT_TU_CHOI')"
    )
    this.schema.raw(
      "ALTER TABLE proposal_registrations ADD CONSTRAINT proposal_registrations_status_check CHECK (status IN ('DRAFT','CHO_DON_VI','CHO_PKH'))"
    )
  }
}
