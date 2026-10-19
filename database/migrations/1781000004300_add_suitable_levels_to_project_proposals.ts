import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Đề xuất giữ đủ các cấp đã chọn từ ý tưởng (QT-I … QT-V),
 * song song với project_process_type_id (cấp chính để khớp kỳ CFP).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table.jsonb('suitable_levels').notNullable().defaultTo('[]')
    })

    // Đề xuất từ ý tưởng: copy toàn bộ suitable_levels của ý tưởng
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_proposals p
        SET suitable_levels = COALESCE(i.suitable_levels, '[]'::jsonb)
        FROM ideas i
        WHERE p.source_idea_id = i.id
          AND (
            p.suitable_levels IS NULL
            OR p.suitable_levels = '[]'::jsonb
          )
      `)

      // Đề xuất không có nguồn ý tưởng: lấy mã QT từ loại quy trình đang gắn
      await db.rawQuery(`
        UPDATE project_proposals p
        SET suitable_levels = jsonb_build_array(t.code)
        FROM project_process_types t
        WHERE p.project_process_type_id = t.id
          AND (
            p.suitable_levels IS NULL
            OR p.suitable_levels = '[]'::jsonb
          )
      `)
    })
  }

  async down() {
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('suitable_levels')
    })
  }
}
