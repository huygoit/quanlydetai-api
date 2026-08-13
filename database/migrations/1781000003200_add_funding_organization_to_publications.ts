import { BaseSchema } from '@adonisjs/lucid/schema'

/** Bổ sung đơn vị tài trợ cho bài báo khoa học (phục vụ khen thưởng sau này). */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('funding_organization', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('funding_organization')
    })
  }
}
