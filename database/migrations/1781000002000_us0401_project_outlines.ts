import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-01: bảng thuyết minh chi tiết (copy dữ liệu từ đề xuất, không ghi đè proposal).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_outlines', (table) => {
      table.increments('id').primary()
      table
        .integer('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
        .onDelete('RESTRICT')
      table.string('code', 40).notNullable().unique()
      table.string('status', 40).notNullable().defaultTo('THUYETMINH_DRAFT')

      // A. Thông tin chung (copy + chỉnh)
      table.string('title', 500).notNullable()
      table.integer('project_process_type_id').unsigned().nullable()
      table.string('level', 20).nullable()
      table.string('field', 100).nullable()
      table.timestamp('start_date', { useTz: true }).nullable()
      table.timestamp('end_date', { useTz: true }).nullable()
      table.bigInteger('requested_budget').notNullable().defaultTo(0)
      table.string('host_unit', 255).nullable()
      table.text('partner_units').nullable() // JSON array {name, role}
      table.text('application_scope').nullable()

      // B. Thuyết minh khoa học
      table.text('urgency').nullable()
      table.text('detailed_objectives').nullable()
      table.text('research_content').nullable()
      table.text('methodology').nullable()
      table.text('milestones').nullable() // JSON
      table.text('expected_products').nullable() // JSON

      // Copy tham chiếu từ đề xuất
      table.text('summary').nullable()
      table.text('council_feedback').nullable()

      // E. Tài liệu
      table.string('outline_file_url', 500).nullable()
      table.string('appendix_file_url', 500).nullable()

      table.integer('completion_percent').notNullable().defaultTo(0)
      table.integer('owner_id').unsigned().notNullable().references('id').inTable('users')
      table.string('owner_name', 255).notNullable()
      table.string('owner_email', 255).nullable()
      table.string('owner_unit', 255).nullable()

      table.integer('submitted_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('withdrawn_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['project_proposal_id'])
      table.index(['owner_id', 'status'])
    })

    this.schema.createTable('project_outline_members', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.integer('profile_id').unsigned().nullable()
      table.integer('student_id').unsigned().nullable()
      table.integer('department_id').unsigned().nullable()
      table.string('full_name', 255).notNullable()
      table.integer('member_order').notNullable().defaultTo(1)
      table.string('role', 20).notNullable().defaultTo('MEMBER')
      table.string('affiliation_type', 40).nullable()
      table.text('affiliation_units').nullable()
      table.decimal('participation_hours', 10, 2).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id'])
    })

    this.schema.createTable('project_outline_budget_lines', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.string('group_code', 40).notNullable() // NHAN_CONG | VAT_TU | HOI_THAO | KHAC
      table.string('content', 500).notNullable()
      table.bigInteger('amount').notNullable().defaultTo(0)
      table.string('note', 1000).nullable()
      table.integer('line_order').notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_outline_id'])
    })

    this.schema.createTable('project_outline_audits', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.integer('actor_id').unsigned().nullable().references('id').inTable('users')
      table.string('action', 60).notNullable()
      table.string('from_status', 40).nullable()
      table.string('to_status', 40).nullable()
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['project_outline_id'])
    })
  }

  async down() {
    this.schema.dropTable('project_outline_audits')
    this.schema.dropTable('project_outline_budget_lines')
    this.schema.dropTable('project_outline_members')
    this.schema.dropTable('project_outlines')
  }
}
