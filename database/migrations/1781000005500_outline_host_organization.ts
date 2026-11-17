import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thuyết minh — thông tin tổ chức chủ trì nhiệm vụ (mục 7.1 / 7.2).
 * Đồng bộ tên → host_unit để tương thích validate cũ.
 */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('host_organization').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_outlines
        SET host_organization = jsonb_build_object(
          'name', COALESCE(host_unit, ''),
          'orgCode', '',
          'phone', '',
          'address', '',
          'leaderName', '',
          'experienceHtml', '',
          'teamCapacityHtml', ''
        )
        WHERE host_unit IS NOT NULL AND host_unit <> ''
          AND host_organization IS NULL
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('host_organization')
    })
  }
}
