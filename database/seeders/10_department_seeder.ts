import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Department from '#models/department'
import fs from 'node:fs'
import path from 'node:path'

/** Xác định type đơn vị từ tên */
function inferType(name: string): 'UNIVERSITY' | 'BOARD' | 'OFFICE' | 'FACULTY' | 'CENTER' | 'COUNCIL' | 'OTHER' {
  if (name.startsWith('Trường Đại học')) return 'UNIVERSITY'
  if (name.startsWith('Ban Giám hiệu')) return 'BOARD'
  if (name.startsWith('Phòng')) return 'OFFICE'
  if (name.startsWith('Khoa')) return 'FACULTY'
  if (name.startsWith('Trung tâm')) return 'CENTER'
  if (name.startsWith('Hội đồng')) return 'COUNCIL'
  return 'OTHER'
}

/**
 * Seed danh mục đơn vị từ file prompts/danhsach-don-vi.txt.
 * Format: code,tên (mỗi dòng).
 * Xóa dữ liệu cũ trước khi seed mới.
 */
export default class DepartmentSeeder extends BaseSeeder {
  async run() {
    const filePath = path.join(process.cwd(), 'prompts', 'danhsach-don-vi.txt')
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const rows: { code: string; name: string; type: 'UNIVERSITY' | 'BOARD' | 'OFFICE' | 'FACULTY' | 'CENTER' | 'COUNCIL' | 'OTHER' }[] = []
    for (const line of lines) {
      const commaIdx = line.indexOf(',')
      if (commaIdx < 0) continue
      const code = line.slice(0, commaIdx).trim()
      const name = line.slice(commaIdx + 1).trim()
      if (!code || !name) continue
      rows.push({
        code,
        name,
        type: inferType(name),
      })
    }

    await Department.query().delete()
    for (let i = 0; i < rows.length; i++) {
      await Department.create({
        code: rows[i].code,
        name: rows[i].name,
        shortName: null,
        type: rows[i].type,
        displayOrder: i + 1,
        status: 'ACTIVE',
        note: null,
      })
    }
  }
}
