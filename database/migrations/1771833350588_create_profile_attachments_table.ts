import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profile_attachments'

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
      table.string('type', 20).notNullable()
      table.string('name', 255).notNullable()
      table.text('url').notNullable()
      table.timestamp('uploaded_at').notNullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
