import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profile_languages'

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
      table.string('language', 50).notNullable()
      table.string('level', 20).nullable()
      table.string('certificate', 100).nullable()
      table.text('certificate_url').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
