import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Field from '#models/field'

type FieldSeed = { code: string; name: string }

/** 19 lĩnh vực đào tạo/nghiên cứu. */
const FIELDS: FieldSeed[] = [
  { code: 'CNTT', name: 'Máy tính và công nghệ thông tin' },
  { code: 'KHTN', name: 'Khoa học tự nhiên' },
  { code: 'MT', name: 'Môi trường và bảo vệ môi trường' },
  { code: 'GD', name: 'Khoa học giáo dục và đào tạo giáo viên' },
  { code: 'KDQL', name: 'Kinh doanh và quản lý' },
  { code: 'NV', name: 'Nhân văn' },
  { code: 'KHSS', name: 'Khoa học và sự sống' },
  { code: 'PL', name: 'Pháp luật' },
  { code: 'BCTT', name: 'Báo chí và thông tin' },
  { code: 'SK', name: 'Sức khỏe' },
  { code: 'DVXH', name: 'Dịch vụ xã hội' },
  { code: 'TTK', name: 'Toán và thống kê' },
  { code: 'CNKT', name: 'Công nghệ kỹ thuật' },
  { code: 'KHXHHV', name: 'Khoa học xã hội và hành vi' },
  { code: 'SXCB', name: 'Sản xuất và chế biến' },
  { code: 'NLNTS', name: 'Nông lâm nghiệp và thủy sản' },
  { code: 'DLKS', name: 'Du lịch, khách sạn, thể thao và dịch vụ cá nhân' },
  { code: 'KT', name: 'Kỹ thuật' },
  { code: 'KTXD', name: 'Kiến trúc và xây dựng' },
  { code: 'NT', name: 'Nghệ thuật' },
]

/**
 * Seed danh mục lĩnh vực.
 * Idempotent theo code (updateOrCreate) → chạy lại nhiều lần không tạo trùng,
 * an toàn chạy trên production.
 */
export default class FieldSeeder extends BaseSeeder {
  async run() {
    for (let i = 0; i < FIELDS.length; i++) {
      const item = FIELDS[i]
      await Field.updateOrCreate(
        { code: item.code },
        {
          code: item.code,
          name: item.name,
          displayOrder: (i + 1) * 10,
          status: 'ACTIVE',
        }
      )
    }
  }
}
