import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'council_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 20).notNullable().unique()
      table.string('title', 255).notNullable()
      table.integer('year').notNullable()
      table.date('meeting_date').nullable()
      table.string('location', 255).nullable()
      table.string('status', 20).notNullable().defaultTo('DRAFT')
      table.bigInteger('created_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('created_by_name', 255).notNullable()
      table.integer('member_count').notNullable().defaultTo(0)
      table.integer('idea_count').notNullable().defaultTo(0)
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
