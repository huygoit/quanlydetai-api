import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_ideas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('session_id').unsigned().notNullable().references('id').inTable('council_sessions').onDelete('CASCADE')
      table.bigInteger('idea_id').unsigned().notNullable().references('id').inTable('ideas').onDelete('CASCADE')
      table.string('idea_code', 20).notNullable()
      table.string('idea_title', 500).notNullable()
      table.string('owner_name', 255).notNullable()
      table.string('owner_unit', 255).notNullable()
      table.string('field', 100).notNullable()
      table.string('status_snapshot', 30).nullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
