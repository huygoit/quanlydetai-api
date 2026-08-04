import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thành viên đề xuất đề tài — liên kết proposal ↔ hồ sơ NCV/sinh viên,
 * thứ tự, affiliation (giống publication_authors, không có vai trò đầu/liên hệ).
 */
export default class extends BaseSchema {
  protected tableName = 'project_proposal_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('project_proposal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('project_proposals')
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
      table.string('affiliation_type', 20).notNullable().defaultTo('UDN_ONLY')
      table.boolean('is_multi_affiliation_outside_udn').notNullable().defaultTo(false)
      table.jsonb('affiliation_units').notNullable().defaultTo('[]')
      table.decimal('contribution_percent', 5, 2).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['project_proposal_id', 'member_order'])
      table.index('project_proposal_id')
      table.index('profile_id')
      table.index('student_id')
      table.index('department_id')
    })

    this.schema.raw(
      "ALTER TABLE project_proposal_members ADD CONSTRAINT project_proposal_members_affiliation_type_check CHECK (affiliation_type IN ('UDN_ONLY','MIXED','OUTSIDE'))"
    )
    this.schema.raw(
      "ALTER TABLE project_proposal_members ADD CONSTRAINT project_proposal_members_gender_check CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
