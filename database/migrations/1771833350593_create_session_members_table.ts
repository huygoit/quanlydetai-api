import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('session_id').unsigned().notNullable().references('id').inTable('council_sessions').onDelete('CASCADE')
      table.bigInteger('member_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('member_name', 255).notNullable()
      table.string('member_email', 255).nullable()
      table.string('role_in_council', 20).notNullable()
      table.string('unit', 255).nullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
