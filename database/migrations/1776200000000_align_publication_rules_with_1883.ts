import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Đồng bộ rules công bố theo Phụ lục 1883/QĐ-ĐHSP:
 * - WOS/Scopus: points_value theo từng Q, hours_value cột giờ, rule FIXED (engine nhân hệ số a ở bước tính).
 * - PUB_DOMESTIC_HDGNN: rule HDGSNN_POINTS_TO_HOURS, hours_value=600 (giờ/điểm), points theo điểm nhập.
 * - PUB_CONF_ISBN: points=0.5, hours=300.
 */
export default class extends BaseSchema {
  async up() {
    await db.rawQuery(`
      UPDATE research_output_rules AS r
      SET
        rule_kind = CASE t.code
          WHEN 'PUB_DOMESTIC_HDGNN' THEN 'HDGSNN_POINTS_TO_HOURS'
          ELSE 'FIXED'
        END,
        points_value = CASE t.code
          WHEN 'PUB_WOS_Q1' THEN 3.0
          WHEN 'PUB_WOS_Q2' THEN 2.75
          WHEN 'PUB_WOS_Q3' THEN 2.5
          WHEN 'PUB_WOS_Q4' THEN 2.25
          WHEN 'PUB_WOS_NO_Q' THEN 2.0
          WHEN 'PUB_SCOPUS_Q1' THEN 2.5
          WHEN 'PUB_SCOPUS_Q2' THEN 2.25
          WHEN 'PUB_SCOPUS_Q3' THEN 2.0
          WHEN 'PUB_SCOPUS_Q4' THEN 1.75
          WHEN 'PUB_SCOPUS_NO_Q' THEN 1.5
          WHEN 'PUB_CONF_ISBN' THEN 0.5
          WHEN 'PUB_DOMESTIC_HDGNN' THEN NULL
          ELSE r.points_value
        END,
        hours_value = CASE t.code
          WHEN 'PUB_WOS_Q1' THEN 1800
          WHEN 'PUB_WOS_Q2' THEN 1650
          WHEN 'PUB_WOS_Q3' THEN 1500
          WHEN 'PUB_WOS_Q4' THEN 1350
          WHEN 'PUB_WOS_NO_Q' THEN 1200
          WHEN 'PUB_SCOPUS_Q1' THEN 1500
          WHEN 'PUB_SCOPUS_Q2' THEN 1350
          WHEN 'PUB_SCOPUS_Q3' THEN 1200
          WHEN 'PUB_SCOPUS_Q4' THEN 1050
          WHEN 'PUB_SCOPUS_NO_Q' THEN 900
          WHEN 'PUB_CONF_ISBN' THEN 300
          WHEN 'PUB_DOMESTIC_HDGNN' THEN 600
          ELSE r.hours_value
        END
      FROM research_output_types AS t
      WHERE r.type_id = t.id
        AND t.code IN (
          'PUB_WOS_Q1','PUB_WOS_Q2','PUB_WOS_Q3','PUB_WOS_Q4','PUB_WOS_NO_Q',
          'PUB_SCOPUS_Q1','PUB_SCOPUS_Q2','PUB_SCOPUS_Q3','PUB_SCOPUS_Q4','PUB_SCOPUS_NO_Q',
          'PUB_DOMESTIC_HDGNN','PUB_CONF_ISBN'
        )
    `)
  }

  async down() {
    await db.rawQuery(`
      UPDATE research_output_rules AS r
      SET
        rule_kind = 'FIXED',
        points_value = 1,
        hours_value = CASE t.code
          WHEN 'PUB_WOS_Q1' THEN 1800
          WHEN 'PUB_WOS_Q2' THEN 1650
          WHEN 'PUB_WOS_Q3' THEN 1500
          WHEN 'PUB_WOS_Q4' THEN 1350
          WHEN 'PUB_WOS_NO_Q' THEN 1200
          WHEN 'PUB_SCOPUS_Q1' THEN 1500
          WHEN 'PUB_SCOPUS_Q2' THEN 1350
          WHEN 'PUB_SCOPUS_Q3' THEN 1200
          WHEN 'PUB_SCOPUS_Q4' THEN 1050
          WHEN 'PUB_SCOPUS_NO_Q' THEN 900
          WHEN 'PUB_CONF_ISBN' THEN 300
          WHEN 'PUB_DOMESTIC_HDGNN' THEN 400
          ELSE r.hours_value
        END
      FROM research_output_types AS t
      WHERE r.type_id = t.id
        AND t.code IN (
          'PUB_WOS_Q1','PUB_WOS_Q2','PUB_WOS_Q3','PUB_WOS_Q4','PUB_WOS_NO_Q',
          'PUB_SCOPUS_Q1','PUB_SCOPUS_Q2','PUB_SCOPUS_Q3','PUB_SCOPUS_Q4','PUB_SCOPUS_NO_Q',
          'PUB_DOMESTIC_HDGNN','PUB_CONF_ISBN'
        )
    `)
  }
}
