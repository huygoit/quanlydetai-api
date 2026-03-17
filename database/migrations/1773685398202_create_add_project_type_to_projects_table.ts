import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'projects'

  async up() {
    const hasProjectType = await this.schema.hasColumn(this.tableName, 'project_type')
    if (hasProjectType) return

    this.schema.alterTable(this.tableName, (table) => {
      table.string('project_type', 50).notNullable().defaultTo('RESEARCH_PROJECT')
      table.index('project_type')
    })
  }

  async down() {
    const hasProjectType = await this.schema.hasColumn(this.tableName, 'project_type')
    if (!hasProjectType) return

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('project_type')
    })
  }
}