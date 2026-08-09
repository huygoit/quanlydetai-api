import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-02: phân công phản biện kín cho thuyết minh.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_outline_review_assignments', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')

      /** User nội bộ (có tài khoản); ngoài trường có thể null trước khi kích hoạt */
      table.integer('reviewer_user_id').unsigned().nullable().references('id').inTable('users')
      table.integer('scientific_profile_id').unsigned().nullable()
      table.string('reviewer_name', 255).notNullable()
      table.string('reviewer_email', 255).nullable()
      table.boolean('is_external').notNullable().defaultTo(false)

      /** INVITED | ACTIVE | CANCELLED | COMPLETED */
      table.string('status', 30).notNullable().defaultTo('INVITED')
      table.timestamp('deadline_at', { useTz: true }).notNullable()

      table.integer('assigned_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('assigned_at', { useTz: true }).notNullable()
      table.text('expertise_exception_reason').nullable()
      table.text('workload_override_reason').nullable()

      table.text('cancel_reason').nullable()
      table.integer('cancelled_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.integer('replaced_by_assignment_id').unsigned().nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['project_outline_id', 'status'])
      table.index(['reviewer_user_id', 'status'])
    })

    // Snapshot cấu hình lần phân công trên outline
    this.schema.alterTable('project_outlines', (table) => {
      table.timestamp('review_assigned_at', { useTz: true }).nullable()
      table.integer('review_assigned_by').unsigned().nullable().references('id').inTable('users')
      table.integer('reviewer_count_target').nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('review_assigned_at')
      table.dropColumn('review_assigned_by')
      table.dropColumn('reviewer_count_target')
    })
    this.schema.dropTable('project_outline_review_assignments')
  }
}
