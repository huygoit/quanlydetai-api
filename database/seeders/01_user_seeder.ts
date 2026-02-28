import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

/**
 * Seed các user mặc định cho hệ thống (theo đặc tả 01-auth-users.md).
 * Lưu ý: KHÔNG hash password thủ công - Model sẽ tự động hash nhờ withAuthFinder mixin
 */
const users = [
 {
   email: 'admin@university.edu.vn',
   password: 'admin123',
   fullName: 'Admin',
   role: 'ADMIN' as const,
   roleLabel: 'Quản trị viên',
   unit: 'Phòng CNTT',
 },
 {
   email: 'phongkh@university.edu.vn',
   password: 'password',
   fullName: 'Phòng Khoa học',
   role: 'PHONG_KH' as const,
   roleLabel: 'Phòng Khoa học',
   unit: 'Phòng KH',
 },
 {
   email: 'hoidong@university.edu.vn',
   password: 'password',
   fullName: 'Hội đồng KH',
   role: 'HOI_DONG' as const,
   roleLabel: 'Hội đồng',
   unit: 'Hội đồng KH',
 },
 {
   email: 'lanhdao@university.edu.vn',
   password: 'password',
   fullName: 'Lãnh đạo',
   role: 'LANH_DAO' as const,
   roleLabel: 'Lãnh đạo',
   unit: 'Ban Giám hiệu',
 },
 {
   email: 'truongkhoa@university.edu.vn',
   password: 'password',
   fullName: 'Trưởng Khoa CNTT',
   role: 'TRUONG_DON_VI' as const,
   roleLabel: 'Trưởng đơn vị',
   unit: 'Khoa CNTT',
 },
 {
   email: 'ncv@university.edu.vn',
   password: 'password',
   fullName: 'Nguyễn Văn A',
   role: 'NCV' as const,
   roleLabel: 'Nhà khoa học',
   unit: 'Khoa CNTT',
 },
 {
   email: 'cndt@university.edu.vn',
   password: 'password',
   fullName: 'Trần Văn B',
   role: 'CNDT' as const,
   roleLabel: 'Chủ nhiệm đề tài',
   unit: 'Khoa Kinh tế',
 },
]

export default class UserSeeder extends BaseSeeder {
  async run() {
    for (const u of users) {
      const exists = await User.findBy('email', u.email)
      if (exists) continue
      // Password sẽ được tự động hash bởi withAuthFinder mixin trong Model
      await User.create({
        email: u.email,
        password: u.password,
        fullName: u.fullName,
        role: u.role,
        roleLabel: u.roleLabel,
        unit: u.unit,
        isActive: true,
      })
    }
  }
}
