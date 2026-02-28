import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng tác giả bài báo (liên kết publication – profile, thứ tự, vai trò, affiliation).
 * Phục vụ tính giờ NCKH theo QĐ 1883.
 */
export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('publication_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('publications')
        .onDelete('CASCADE')
      table
        .bigInteger('profile_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('scientific_profiles')
        .onDelete('SET NULL')
      table.string('full_name', 255).notNullable()
      table.integer('author_order').notNullable()
      table.boolean('is_main_author').notNullable().defaultTo(false)
      table.boolean('is_corresponding').notNullable().defaultTo(false)
      table.string('affiliation_type', 20).notNullable().defaultTo('UDN_ONLY')
      table.boolean('is_multi_affiliation_outside_udn').notNullable().defaultTo(false)
      table.decimal('contribution_percent', 5, 2).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['publication_id', 'author_order'])
      table.index('publication_id')
      table.index('profile_id')
    })
    this.schema.raw(
      "ALTER TABLE publication_authors ADD CONSTRAINT publication_authors_affiliation_type_check CHECK (affiliation_type IN ('UDN_ONLY','MIXED','OUTSIDE'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
