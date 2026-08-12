import { BaseSeeder } from '@adonisjs/lucid/seeders'
import StaffPosition from '#models/staff_position'

/**
 * Seed danh mục chức vụ — 2 loại POSITION + PARTY.
 * Nguồn:
 * - tailieu/chuc-vu/chuc_vu.md (35 chức vụ)
 * - tailieu/chuc-vu/danh-sach-chuc-vu-dang.md (6 chức vụ Đảng)
 *
 * Chạy: node ace db:seed --files=database/seeders/19_staff_position_seeder.ts
 */

/** chuc_vu.md — kind POSITION */
const POSITION_NAMES: string[] = [
  'Hiệu trưởng',
  'Phó Hiệu trưởng',
  'Trưởng phòng',
  'Phó Trưởng phòng',
  'Phó Trưởng phòng phụ trách',
  'Trưởng khoa',
  'Phó Trưởng khoa',
  'Trưởng ban',
  'Chủ tịch Hội đồng Trường',
  'Giám đốc Trung tâm',
  'Phó Trưởng khoa phụ trách',
  'Trưởng Bộ môn',
  'Tổ trưởng',
  'Kế toán trưởng',
  'Chủ tịch Hội Sinh viên',
  'Phó Bí thư Đoàn trường',
  'Ủy viên Ban Thường vụ Đảng ủy',
  'Bí thư Chi bộ',
  'Phụ trách, điều hành Khoa',
  'Điều hành Khoa',
  'Giám đốc Trung tâm Tin học',
  'Bí thư Đoàn trường',
  'Phó Giám đốc Trung tâm Tin học',
  'Phó Trưởng Bộ môn phụ trách',
  'Trợ lý Khoa học, Sau đại học',
  'Bí thư Liên chi đoàn',
  'Chủ tịch Công đoàn bộ phận',
  'Phó Chủ tịch Hội Sinh viên',
  'Phó Bí thư Chi bộ',
  'Ủy viên Thường vụ Đoàn',
  'Trưởng Ban nữ công Trường',
  'Ủy viên Thường vụ Công đoàn ĐHĐN',
  'Chủ nhiệm Ủy ban Kiểm tra Công đoàn ĐHĐN',
  'Chủ tịch Công đoàn Trường ĐHSP',
  'Ủy viên Ban Chấp hành Công đoàn cơ sở',
]

/** danh-sach-chuc-vu-dang.md — kind PARTY */
const PARTY_NAMES: string[] = [
  'Ủy viên Ban Chấp hành Đảng bộ Cơ quan Đại học Đà Nẵng',
  'Bí thư Chi bộ',
  'Phó Bí thư Chi bộ',
  'Ủy viên Ban Thường vụ Đảng ủy cơ sở',
  'Bí thư Đảng ủy Trường',
  'Chi ủy viên',
]

function slugCode(prefix: string, name: string, index: number): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
    .slice(0, 55)
  return `${prefix}_${base || index}_${index}`
}

export default class extends BaseSeeder {
  async run() {
    for (let i = 0; i < POSITION_NAMES.length; i++) {
      const name = POSITION_NAMES[i]
      const code = slugCode('POS', name, i + 1)
      await StaffPosition.updateOrCreate(
        { code },
        {
          kind: 'POSITION',
          name,
          displayOrder: (i + 1) * 10,
          status: 'ACTIVE',
        }
      )
    }

    for (let i = 0; i < PARTY_NAMES.length; i++) {
      const name = PARTY_NAMES[i]
      const code = slugCode('PARTY', name, i + 1)
      await StaffPosition.updateOrCreate(
        { code },
        {
          kind: 'PARTY',
          name,
          displayOrder: (i + 1) * 10,
          status: 'ACTIVE',
        }
      )
    }
  }
}
