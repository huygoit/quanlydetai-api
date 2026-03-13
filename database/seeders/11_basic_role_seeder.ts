import { BaseSeeder } from '@adonisjs/lucid/seeders'
import BasicRoleService from '#services/basic_role_service'

/**
 * Tạo role Basic (hệ thống) cho người mới đăng ký.
 * Gán các quyền mặc định: profile.view_own, profile.update_own, idea.view, idea.create, idea.update, idea.submit
 */
export default class BasicRoleSeeder extends BaseSeeder {
  async run() {
    await BasicRoleService.getOrCreateBasicRole()
  }
}
