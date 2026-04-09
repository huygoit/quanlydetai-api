import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Điểm quy đổi mặc định cho bài báo (leaf PUB_*) rule FIXED: nâng points_value lên 3 (trước đây seed = 1).
 */
export default class extends BaseSchema {
  async up() {
    await db.rawQuery(`
      UPDATE research_output_rules AS r
      SET points_value = 3
      FROM research_output_types AS t
      WHERE r.type_id = t.id
        AND UPPER(COALESCE(r.rule_kind, '')) = 'FIXED'
        AND t.code LIKE 'PUB_%'
        AND (r.points_value IS NULL OR r.points_value < 2)
    `)
  }

  async down() {
    await db.rawQuery(`
      UPDATE research_output_rules AS r
      SET points_value = 1
      FROM research_output_types AS t
      WHERE r.type_id = t.id
        AND UPPER(COALESCE(r.rule_kind, '')) = 'FIXED'
        AND t.code LIKE 'PUB_%'
        AND r.points_value = 3
    `)
  }
}
