import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Điều chỉnh nhiệm vụ: bỏ evidence_url (nhập tay),
 * chuyển sang evidence_attachments (chỉ upload file).
 */
export default class extends BaseSchema {
  protected tableName = 'project_adjustments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('evidence_attachments').nullable()
    })

    // Giữ dữ liệu cũ nếu có URL → chuyển thành 1 phần tử attachments
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_adjustments
        SET evidence_attachments = jsonb_build_array(
          jsonb_build_object(
            'fileName', 'minh-chung',
            'fileUrl', evidence_url,
            'fileSize', 0
          )
        )
        WHERE evidence_url IS NOT NULL AND evidence_url <> ''
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('evidence_url')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('evidence_url', 500).nullable()
    })
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE project_adjustments
        SET evidence_url = evidence_attachments->0->>'fileUrl'
        WHERE evidence_attachments IS NOT NULL
          AND jsonb_typeof(evidence_attachments) = 'array'
          AND jsonb_array_length(evidence_attachments) > 0
      `)
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('evidence_attachments')
    })
  }
}
