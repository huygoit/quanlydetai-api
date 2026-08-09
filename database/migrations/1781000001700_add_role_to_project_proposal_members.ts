import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thêm vai trò thành viên đề xuất: Chủ nhiệm / Thư ký / Thành viên.
 */
export default class extends BaseSchema {
  protected tableName = 'project_proposal_members'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('role', 20).notNullable().defaultTo('MEMBER')
    })

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT project_proposal_members_role_check
      CHECK (role IN ('PRINCIPAL', 'SECRETARY', 'MEMBER'))
    `)

    // Dòng thứ tự 1 (nếu có) → Chủ nhiệm cho dữ liệu cũ
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_proposal_members m
        SET role = 'PRINCIPAL'
        WHERE m.member_order = 1
          AND NOT EXISTS (
            SELECT 1 FROM project_proposal_members x
            WHERE x.project_proposal_id = m.project_proposal_id
              AND x.role = 'PRINCIPAL'
          )
      `)
    })
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS project_proposal_members_role_check`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
    })
  }
}
