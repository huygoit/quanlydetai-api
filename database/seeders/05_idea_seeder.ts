import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Idea from '#models/idea'

/**
 * Seed 8 ý tưởng mẫu với các trạng thái khác nhau (theo prompt 05-ideas).
 * owner_id 6 = NCV, 7 = CNDT (từ user_seeder).
 */
const ideas = [
  { code: 'YT-2024-001', title: 'Ứng dụng AI trong chẩn đoán y tế', summary: 'Nghiên cứu và phát triển hệ thống AI hỗ trợ chẩn đoán bệnh lý hình ảnh.', field: 'Y học', suitableLevels: ['BO_GDDT', 'NHA_NUOC'], ownerId: 6, ownerName: 'Nguyễn Văn A', ownerUnit: 'Khoa CNTT', status: 'SUBMITTED' as const },
  { code: 'YT-2024-002', title: 'Phát triển nền tảng học trực tuyến', summary: 'Xây dựng nền tảng LMS tích hợp AI cá nhân hóa học tập.', field: 'Giáo dục', suitableLevels: ['TRUONG_DAT_HANG', 'DAI_HOC_DA_NANG'], ownerId: 6, ownerName: 'Nguyễn Văn A', ownerUnit: 'Khoa CNTT', status: 'REVIEWING' as const },
  { code: 'YT-2024-003', title: 'Nghiên cứu giống lúa chịu hạn', summary: 'Chọn tạo giống lúa chịu hạn phù hợp vùng Nam Trung Bộ.', field: 'Nông nghiệp', suitableLevels: ['NAFOSTED', 'NHA_NUOC'], ownerId: 7, ownerName: 'Trần Văn B', ownerUnit: 'Khoa Kinh tế', status: 'APPROVED_INTERNAL' as const, priority: 'HIGH' as const },
  { code: 'YT-2024-004', title: 'Blockchain trong chuỗi cung ứng', summary: 'Ứng dụng blockchain minh bạch hóa chuỗi cung ứng nông sản.', field: 'Công nghệ thông tin', suitableLevels: ['DOANH_NGHIEP'], ownerId: 6, ownerName: 'Nguyễn Văn A', ownerUnit: 'Khoa CNTT', status: 'DRAFT' as const },
  { code: 'YT-2024-005', title: 'Kinh tế tuần hoàn cho SMEs', summary: 'Mô hình kinh tế tuần hoàn áp dụng cho doanh nghiệp vừa và nhỏ.', field: 'Kinh tế', suitableLevels: ['TINH_THANH_PHO', 'DOANH_NGHIEP'], ownerId: 7, ownerName: 'Trần Văn B', ownerUnit: 'Khoa Kinh tế', status: 'APPROVED_FOR_ORDER' as const, linkedProjectId: 'DT-2024-001' },
  { code: 'YT-2024-006', title: 'IoT giám sát thủy sản', summary: 'Hệ thống IoT giám sát môi trường ao nuôi thủy sản.', field: 'Kỹ thuật', suitableLevels: ['TRUONG_DAT_HANG'], ownerId: 6, ownerName: 'Nguyễn Văn A', ownerUnit: 'Khoa CNTT', status: 'PROPOSED_FOR_ORDER' as const },
  { code: 'YT-2024-007', title: 'ML dự báo chứng khoán', summary: 'Mô hình machine learning dự báo biến động thị trường chứng khoán.', field: 'Kinh tế', suitableLevels: ['NHA_NUOC'], ownerId: 7, ownerName: 'Trần Văn B', ownerUnit: 'Khoa Kinh tế', status: 'REJECTED' as const, rejectedStage: 'PHONG_KH_SO_LOAI' as const, rejectedReason: 'Ý tưởng chưa khả thi do thiếu dữ liệu đầu vào.', rejectedByRole: 'PHONG_KH', rejectedAt: DateTime.now() },
  { code: 'YT-2024-008', title: 'Phần mềm quản lý bệnh viện', summary: 'Hệ thống quản lý thông tin bệnh viện tích hợp AI.', field: 'Y học', suitableLevels: ['BO_GDDT'], ownerId: 6, ownerName: 'Nguyễn Văn A', ownerUnit: 'Khoa CNTT', status: 'SUBMITTED' as const },
]

export default class IdeaSeeder extends BaseSeeder {
  async run() {
    for (const row of ideas) {
      const exists = await Idea.findBy('code', row.code)
      if (!exists) {
        await Idea.create(row)
      }
    }
  }
}
