import { BaseSchema } from '@adonisjs/lucid/schema'

/** Danh mục quốc gia + quyền IAM + seed nước hay dùng. */
export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      CREATE TABLE IF NOT EXISTS countries (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.db.rawQuery(`CREATE INDEX IF NOT EXISTS countries_status_index ON countries (status)`)
    await this.db.rawQuery(
      `CREATE INDEX IF NOT EXISTS countries_display_order_index ON countries (display_order)`
    )
    await this.db.rawQuery(`CREATE INDEX IF NOT EXISTS countries_name_index ON countries (name)`)

    const now = new Date()
    const countries: Array<[string, string, number]> = [
      ['VN', 'Việt Nam', 1],
      ['AU', 'Úc', 10],
      ['JP', 'Nhật Bản', 20],
      ['KR', 'Hàn Quốc', 30],
      ['CN', 'Trung Quốc', 40],
      ['TW', 'Đài Loan', 45],
      ['SG', 'Singapore', 50],
      ['TH', 'Thái Lan', 55],
      ['MY', 'Malaysia', 60],
      ['ID', 'Indonesia', 65],
      ['PH', 'Philippines', 70],
      ['IN', 'Ấn Độ', 75],
      ['US', 'Hoa Kỳ', 80],
      ['CA', 'Canada', 85],
      ['GB', 'Vương quốc Anh', 90],
      ['FR', 'Pháp', 100],
      ['DE', 'Đức', 110],
      ['NL', 'Hà Lan', 120],
      ['BE', 'Bỉ', 125],
      ['IT', 'Ý', 130],
      ['ES', 'Tây Ban Nha', 135],
      ['RU', 'Nga', 140],
      ['SE', 'Thụy Điển', 150],
      ['NO', 'Na Uy', 155],
      ['FI', 'Phần Lan', 160],
      ['CH', 'Thụy Sĩ', 165],
      ['AT', 'Áo', 170],
      ['PL', 'Ba Lan', 175],
      ['CZ', 'Séc', 180],
      ['NZ', 'New Zealand', 190],
      ['OTHER', 'Khác', 999],
    ]

    for (const [code, name, order] of countries) {
      await this.db.rawQuery(
        `
        INSERT INTO countries (code, name, display_order, status, created_at, updated_at)
        SELECT ?, ?, ?, 'ACTIVE', ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = ?)
      `,
        [code, name, order, now, now, code]
      )
    }

    const perms = [
      ['country.view', 'Xem danh mục quốc gia', 'country', 'view'],
      ['country.create', 'Tạo quốc gia', 'country', 'create'],
      ['country.update', 'Cập nhật quốc gia', 'country', 'update'],
      ['country.delete', 'Xóa quốc gia', 'country', 'delete'],
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
        AND p.code LIKE 'country.%'
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `)
  }

  async down() {
    await this.db.rawQuery(`
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'country.%')
    `)
    await this.db.rawQuery(`DELETE FROM permissions WHERE code LIKE 'country.%'`)
    await this.db.rawQuery(`DROP TABLE IF EXISTS countries`)
  }
}
