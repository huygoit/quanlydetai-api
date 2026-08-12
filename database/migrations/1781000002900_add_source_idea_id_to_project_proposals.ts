import { BaseSchema } from '@adonisjs/lucid/schema'

/** Liên kết đề xuất đề tài được tạo tự động từ ý tưởng đã phê duyệt đặt hàng */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table
        .bigInteger('source_idea_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ideas')
        .onDelete('SET NULL')
      table.unique(['source_idea_id'])
      table.index('source_idea_id')
    })
  }

  async down() {
    this.schema.alterTable('project_proposals', (table) => {
      table.dropUnique(['source_idea_id'])
      table.dropColumn('source_idea_id')
    })
  }
}
