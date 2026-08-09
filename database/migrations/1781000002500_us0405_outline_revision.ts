import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * US-04-05: phiên bản thuyết minh + trường chỉnh sửa sau bảo vệ.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('project_outline_versions', (table) => {
      table.increments('id').primary()
      table
        .integer('project_outline_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_outlines')
        .onDelete('CASCADE')
      table.integer('version_no').notNullable()
      table.integer('parent_version_id').unsigned().nullable()
      /** BASELINE_AFTER_DEFENSE | REVISION_SUBMITTED */
      table.string('version_type', 40).notNullable()
      /** LOCKED — bất biến sau khi tạo */
      table.string('status', 20).notNullable().defaultTo('LOCKED')
      table.text('snapshot_json').notNullable()
      table.string('outline_file_url', 500).nullable()
      table.string('appendix_file_url', 500).nullable()
      table.text('explanation').nullable()
      table.integer('defense_session_id').unsigned().nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('locked_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_outline_id', 'version_no'])
      table.index(['project_outline_id', 'version_type'])
    })

    this.schema.alterTable('project_outlines', (table) => {
      table.timestamp('revision_deadline', { useTz: true }).nullable()
      table.text('revision_explanation').nullable()
      table.integer('revision_baseline_version_id').unsigned().nullable()
      table.integer('revision_submitted_version_id').unsigned().nullable()
      table.timestamp('revision_submitted_at', { useTz: true }).nullable()
      table.timestamp('revision_reminder_sent_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('project_outlines', (table) => {
      table.dropColumn('revision_deadline')
      table.dropColumn('revision_explanation')
      table.dropColumn('revision_baseline_version_id')
      table.dropColumn('revision_submitted_version_id')
      table.dropColumn('revision_submitted_at')
      table.dropColumn('revision_reminder_sent_at')
    })
    this.schema.dropTable('project_outline_versions')
  }
}
