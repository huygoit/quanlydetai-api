import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thuyết minh — phân bổ nguồn kinh phí đề xuất (theo chủ thể / tính chất).
 * Tổng đồng bộ sang requested_budget.
 */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('funding_breakdown').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_outlines
        SET funding_breakdown = jsonb_build_object(
          'schoolFund', COALESCE(requested_budget, 0),
          'externalStateLocal', 0,
          'externalEnterprise', 0,
          'externalSponsor', 0,
          'externalOther', 0,
          'stateBudget', 0,
          'nonStateBudget', 0
        )
        WHERE funding_breakdown IS NULL
          AND requested_budget IS NOT NULL
          AND requested_budget > 0
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('funding_breakdown')
    })
  }
}
