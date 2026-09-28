import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StaffPosition from '#models/staff_position'
import { timIdChucVuTrongChuoi } from '#utils/staff_position_excel_match'

/**
 * Debug: xem catalog DB + thử khớp vài chuỗi Excel.
 * node ace debug:staff-position-match
 */
export default class DebugStaffPositionMatch extends BaseCommand {
  static commandName = 'debug:staff-position-match'
  static description = 'In catalog chức vụ + thử khớp mẫu Excel'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ flagName: 'text', description: 'Chuỗi Excel cần thử' })
  declare text?: string

  @flags.string({ flagName: 'kind', description: 'POSITION | PARTY' })
  declare kind?: string

  async run() {
    const all = await StaffPosition.query().orderBy('kind', 'asc').orderBy('id', 'asc')
    this.logger.info(`Tổng staff_positions: ${all.length}`)
    const byKind: Record<string, number> = {}
    for (const r of all) {
      const k = `${r.kind}/${r.status}`
      byKind[k] = (byKind[k] || 0) + 1
    }
    this.logger.info(`Theo kind/status: ${JSON.stringify(byKind)}`)
    for (const r of all) {
      this.logger.info(`  [${r.id}] ${r.kind} ${r.status} | ${r.name}`)
    }

    const kind = (this.kind || 'POSITION').toUpperCase()
    const catalog = all
      .filter((p) => p.kind === kind && p.status === 'ACTIVE')
      .map((p) => ({ id: p.id, name: p.name }))

    const samples =
      this.text != null && this.text !== ''
        ? [this.text]
        : [
            'Hiệu trưởng',
            'Hiệu trưởng, Phó Hiệu trưởng',
            'Phó Trưởng khoa (07/8/2020)',
            'Kế Toán trưởng (01/01/2025 -31/12/2029))',
            'Bí thư chi bộ',
            'Bí thư Đảng uỷ Trường',
            'UV BCH Đảng bộ Cơ quan ĐHĐN',
            'Chi ủy viên',
          ]

    this.logger.info(`Thử khớp kind=${kind}, catalog ACTIVE=${catalog.length}`)
    for (const raw of samples) {
      const r = timIdChucVuTrongChuoi(raw, catalog)
      if (r.ids.length) {
        this.logger.success(`OK "${raw}" -> ids=${r.ids.join(',')}`)
      } else {
        this.logger.error(`FAIL "${raw}" unmatched=${JSON.stringify(r.unmatched)}`)
      }
    }
  }
}
