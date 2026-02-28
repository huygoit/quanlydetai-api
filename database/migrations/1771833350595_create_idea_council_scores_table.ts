import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'idea_council_scores'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('session_id').unsigned().notNullable().references('id').inTable('council_sessions').onDelete('CASCADE')
      table.bigInteger('idea_id').unsigned().notNullable().references('id').inTable('ideas').onDelete('CASCADE')
      table.bigInteger('council_member_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('council_member_name', 255).notNullable()
      table.string('council_role', 20).notNullable()
      table.decimal('novelty_score', 3, 1).notNullable()
      table.text('novelty_comment').nullable()
      table.decimal('feasibility_score', 3, 1).notNullable()
      table.text('feasibility_comment').nullable()
      table.decimal('alignment_score', 3, 1).notNullable()
      table.text('alignment_comment').nullable()
      table.decimal('author_capacity_score', 3, 1).notNullable()
      table.text('author_capacity_comment').nullable()
      table.decimal('weighted_score', 4, 2).notNullable()
      table.text('general_comment').nullable()
      table.boolean('submitted').notNullable().defaultTo(false)
      table.timestamp('submitted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
