import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hồ sơ đăng ký thực hiện một nhiệm vụ trong thông báo.
 * Một người một hồ sơ cho mỗi nhiệm vụ. Thành viên nằm bảng riêng.
 * Nhiệm vụ giữ khung: số thành viên tối đa và có bắt buộc file hay không.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table.integer('max_members').notNullable().defaultTo(10)
      table.boolean('require_registration_file').notNullable().defaultTo(false)
    })

    this.schema.createTable('proposal_registrations', (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 20).notNullable().unique()
      table
        .bigInteger('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
        .onDelete('CASCADE')
      table
        .bigInteger('call_for_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('call_for_proposals')
        .onDelete('CASCADE')
      table
        .bigInteger('owner_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('owner_name', 255).notNullable()
      table.string('owner_email', 255).nullable()
      table.string('owner_unit', 255).notNullable()
      table.bigInteger('proposed_budget').notNullable().defaultTo(0)
      table.integer('duration_months').notNullable()
      table.string('attachment_url', 500).nullable()
      table.text('note').nullable()
      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['project_proposal_id', 'owner_id'])
      table.index('call_for_proposal_id')
      table.index('owner_id')
      table.index('status')
    })

    this.schema.raw(
      "ALTER TABLE proposal_registrations ADD CONSTRAINT proposal_registrations_status_check CHECK (status IN ('DRAFT','SUBMITTED'))"
    )

    this.schema.createTable('proposal_registration_members', (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('proposal_registration_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('proposal_registrations')
        .onDelete('CASCADE')
      table
        .bigInteger('profile_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('scientific_profiles')
        .onDelete('SET NULL')
      table
        .bigInteger('student_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('students')
        .onDelete('SET NULL')
      table
        .bigInteger('department_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      table.string('gender', 10).nullable()
      table.string('full_name', 255).notNullable()
      table.integer('member_order').notNullable()
      table.string('role', 20).notNullable().defaultTo('MEMBER')
      table.string('affiliation_type', 20).notNullable().defaultTo('UDN_ONLY')
      table.boolean('is_multi_affiliation_outside_udn').notNullable().defaultTo(false)
      table.jsonb('affiliation_units').notNullable().defaultTo('[]')
      table.decimal('contribution_percent', 5, 2).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['proposal_registration_id', 'member_order'])
      table.index('proposal_registration_id')
      table.index('profile_id')
      table.index('student_id')
    })

    this.schema.raw(
      "ALTER TABLE proposal_registration_members ADD CONSTRAINT proposal_registration_members_role_check CHECK (role IN ('PRINCIPAL','SECRETARY','MEMBER'))"
    )
    this.schema.raw(
      "ALTER TABLE proposal_registration_members ADD CONSTRAINT proposal_registration_members_affiliation_type_check CHECK (affiliation_type IN ('UDN_ONLY','MIXED','OUTSIDE'))"
    )
    this.schema.raw(
      "ALTER TABLE proposal_registration_members ADD CONSTRAINT proposal_registration_members_gender_check CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER'))"
    )
  }

  async down() {
    this.schema.dropTable('proposal_registration_members')
    this.schema.raw(
      'ALTER TABLE proposal_registrations DROP CONSTRAINT IF EXISTS proposal_registrations_status_check'
    )
    this.schema.dropTable('proposal_registrations')
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('max_members')
      table.dropColumn('require_registration_file')
    })
  }
}
