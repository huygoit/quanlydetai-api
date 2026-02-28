import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng rule engine cho toàn bộ kết quả NCKH (giờ quy đổi theo QĐ 1883).
 * Rule-driven, không hardcode trong code.
 */
export default class extends BaseSchema {
  protected tableName = 'research_output_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('output_group', 50).notNullable()
      table.string('sub_type', 100).notNullable()
      table.string('rule_type', 30).notNullable()
      table.decimal('base_hours', 12, 2).nullable()
      table.decimal('score_multiplier', 12, 4).nullable()
      table.decimal('bonus_hours', 12, 2).nullable()
      table.decimal('min_value', 12, 2).nullable()
      table.decimal('max_value', 12, 2).nullable()
      table.text('description').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()

      table.unique(['output_group', 'sub_type'])
    })
    this.schema.raw(
      "ALTER TABLE research_output_rules ADD CONSTRAINT research_output_rules_rule_type_check CHECK (rule_type IN ('FIXED_HOURS','MULTIPLY_SCORE','MULTIPLY_C','BONUS_HOURS','PERCENT_SPLIT'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
