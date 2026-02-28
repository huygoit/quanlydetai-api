import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publications'

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
      table.string('title', 500).notNullable()
      table.text('authors').notNullable()
      table.string('corresponding_author', 255).nullable()
      table.string('my_role', 20).nullable()
      table.string('publication_type', 20).notNullable()
      table.string('journal_or_conference', 500).notNullable()
      table.integer('year').nullable()
      table.string('volume', 20).nullable()
      table.string('issue', 20).nullable()
      table.string('pages', 50).nullable()
      table.string('rank', 20).nullable()
      table.string('quartile', 5).nullable()
      table.string('doi', 100).nullable()
      table.string('issn', 20).nullable()
      table.string('isbn', 20).nullable()
      table.text('url').nullable()
      table.string('publication_status', 20).notNullable()
      table.string('source', 20).notNullable().defaultTo('INTERNAL')
      table.string('source_id', 100).nullable()
      table.boolean('verified_by_ncv').notNullable().defaultTo(false)
      table.boolean('approved_internal').nullable()
      table.text('attachment_url').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
