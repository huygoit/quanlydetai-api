import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profile_verify_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('profile_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('scientific_profiles')
        .onDelete('CASCADE')
      table.string('action', 20).notNullable()
      table.text('note').nullable()
      table.string('actor_role', 20).notNullable()
      table.string('actor_name', 255).notNullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
