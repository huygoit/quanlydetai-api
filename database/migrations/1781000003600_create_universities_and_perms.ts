import { BaseSchema } from '@adonisjs/lucid/schema'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** Danh mục trường ĐH/HV Việt Nam theo khu vực & khối + seed từ file JSON. */
export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      CREATE TABLE IF NOT EXISTS universities (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        region VARCHAR(32) NOT NULL,
        school_block VARCHAR(20) NOT NULL DEFAULT 'CIVIL',
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        display_order INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.db.rawQuery(`CREATE INDEX IF NOT EXISTS universities_region_index ON universities (region)`)
    await this.db.rawQuery(
      `CREATE INDEX IF NOT EXISTS universities_school_block_index ON universities (school_block)`
    )
    await this.db.rawQuery(`CREATE INDEX IF NOT EXISTS universities_status_index ON universities (status)`)
    await this.db.rawQuery(`CREATE INDEX IF NOT EXISTS universities_name_index ON universities (name)`)
    await this.db.rawQuery(
      `CREATE INDEX IF NOT EXISTS universities_display_order_index ON universities (display_order)`
    )

    const now = new Date()
    // Đường dẫn seed cạnh thư mục migrations
    const here = dirname(fileURLToPath(import.meta.url))
    const seedPath = join(here, '..', 'seed_data', 'universities.json')
    const rows = JSON.parse(readFileSync(seedPath, 'utf8')) as Array<{
      code: string
      name: string
      region: string
      school_block: string
      is_private: boolean
      display_order: number
    }>

    for (const row of rows) {
      await this.db.rawQuery(
        `
        INSERT INTO universities
          (code, name, region, school_block, is_private, display_order, status, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM universities WHERE code = ?)
      `,
        [
          row.code,
          row.name,
          row.region,
          row.school_block,
          row.is_private,
          row.display_order,
          now,
          now,
          row.code,
        ]
      )
    }

    const perms = [
      ['university.view', 'Xem danh mục trường đại học', 'university', 'view'],
      ['university.create', 'Tạo trường đại học', 'university', 'create'],
      ['university.update', 'Cập nhật trường đại học', 'university', 'update'],
      ['university.delete', 'Xóa trường đại học', 'university', 'delete'],
    ]
    for (const [code, name, module, action] of perms) {
      await this.db.rawQuery(
        `
        INSERT INTO permissions (code, name, module, action, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = ?)
      `,
        [code, name, module, action, now, now, code]
      )
    }

    await this.db.rawQuery(`
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      SELECT r.id, p.id, NOW()
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.code IN ('ADMIN', 'SUPER_ADMIN', 'PHONG_KH')
        AND p.code LIKE 'university.%'
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `)
  }

  async down() {
    await this.db.rawQuery(`
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'university.%')
    `)
    await this.db.rawQuery(`DELETE FROM permissions WHERE code LIKE 'university.%'`)
    await this.db.rawQuery(`DROP TABLE IF EXISTS universities`)
  }
}
