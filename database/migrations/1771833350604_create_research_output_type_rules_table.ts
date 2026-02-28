import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rule quy đổi gắn với từng leaf node của research_output_types.
 * Mỗi type (leaf) tối đa một rule: type_id unique.
 */
export default class extends BaseSchema {
  protected tableName = 'research_output_type_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('research_output_types')
        .onDelete('CASCADE')
      table.string('rule_kind', 50).notNullable()
      table.decimal('points_value', 10, 2).nullable()
      table.decimal('hours_value', 10, 2).nullable()
      table.string('hours_multiplier_var', 10).nullable()
      table.decimal('hours_bonus', 10, 2).nullable()
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.text('evidence_requirements').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['type_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
