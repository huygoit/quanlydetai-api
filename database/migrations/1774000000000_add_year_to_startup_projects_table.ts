import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'startup_projects'

  async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'year')
    if (!hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('year').nullable()
        table.index('year')
      })
    }
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'year')
    if (hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropIndex(['year'])
        table.dropColumn('year')
      })
    }
  }
}

