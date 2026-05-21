import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hồ sơ khoa học: organization_id (key UDN_AFFILIATION_UNITS), department_id (FK departments).
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('organization_id', 50).nullable()
      table
        .bigInteger('department_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')

      table.index('organization_id')
      table.index('department_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['organization_id'])
      table.dropIndex(['department_id'])
      table.dropColumn('organization_id')
      table.dropColumn('department_id')
    })
  }
}
