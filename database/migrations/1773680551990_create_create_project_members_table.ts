import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.bigInteger('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE')

      // member_type quyết định dòng này trỏ user nội bộ hay member import raw/external.
      // Allowed: USER, STUDENT, LECTURER, EXTERNAL
      table.string('member_type', 30).notNullable()
      table.bigInteger('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')

      // Import SV_NCKH có thể map user_id, nếu không map được thì giữ member_name/member_code.
      table.string('member_name', 255).nullable()
      table.string('member_code', 100).nullable()
      table.string('email', 255).nullable()

      // Allowed: LEADER, SUPERVISOR, MEMBER, SECRETARY
      table.string('role', 50).notNullable().defaultTo('MEMBER')
      table.boolean('is_main').notNullable().defaultTo(false)

      table.string('unit', 255).nullable()
      table.date('joined_at').nullable()
      table.text('note').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('project_id')
      table.index('member_type')
      table.index('user_id')
      table.index('role')
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX project_members_unique_project_user
      ON ${this.tableName} (project_id, user_id)
      WHERE user_id IS NOT NULL
    `)

    this.schema.raw(`
      CREATE UNIQUE INDEX project_members_unique_project_member_code
      ON ${this.tableName} (project_id, member_code)
      WHERE member_code IS NOT NULL
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}