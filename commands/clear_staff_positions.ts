import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * Xóa toàn bộ danh mục chức vụ và dữ liệu chức vụ trên nhân sự / hồ sơ khoa học.
 */
export default class ClearStaffPositions extends BaseCommand {
  static commandName = 'clear:staff-positions'
  static description =
    'Xóa hết staff_positions và xóa chức vụ trên staffs + current_title trên scientific_profiles'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'yes',
    alias: 'y',
    description: 'Bắt buộc để xác nhận xóa (tránh chạy nhầm)',
  })
  declare yes: boolean

  async run() {
    if (!this.yes) {
      this.logger.error('Thêm --yes để xác nhận xóa toàn bộ dữ liệu chức vụ.')
      this.exitCode = 1
      return
    }

    const trx = await db.transaction()

    try {
      const staffUpdated = await trx
        .from('staffs')
        .update({
          position_title: null,
          concurrent_position: null,
          highest_position: null,
          party_position: null,
        })

      const profileUpdated = await trx
        .from('scientific_profiles')
        .update({ current_title: null })

      let personalUpdated = 0
      const hasPersonal = await trx.rawQuery(
        `SELECT to_regclass('public.personal_profiles') IS NOT NULL AS exists`
      )
      if (hasPersonal.rows?.[0]?.exists) {
        const r = await trx.from('personal_profiles').update({ position_title: null })
        personalUpdated = Number(r) || 0
      }

      await trx.rawQuery('TRUNCATE TABLE staff_positions RESTART IDENTITY CASCADE')

      await trx.commit()

      this.logger.info(`Đã xóa chức vụ trên ${staffUpdated} nhân sự (staffs).`)
      this.logger.info(`Đã xóa current_title trên ${profileUpdated} hồ sơ khoa học.`)
      if (personalUpdated) {
        this.logger.info(`Đã xóa position_title trên ${personalUpdated} personal_profiles.`)
      }
      this.logger.success('Đã TRUNCATE staff_positions (ID reset về 1).')
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
