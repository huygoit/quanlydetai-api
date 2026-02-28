import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Catalog from '#models/catalog'

/**
 * Seed danh mục mặc định (FIELD, UNIT, PROJECT_LEVEL, IDEA_LEVEL, LANGUAGE) theo prompt 02-admin-catalogs.
 */
const fields = [
  { code: 'CNTT', name: 'Công nghệ thông tin', sortOrder: 1 },
  { code: 'KINH_TE', name: 'Kinh tế - Quản lý', sortOrder: 2 },
  { code: 'KHXH', name: 'Khoa học xã hội', sortOrder: 3 },
  { code: 'KY_THUAT', name: 'Kỹ thuật - Công nghệ', sortOrder: 4 },
  { code: 'Y_DUOC', name: 'Y - Dược', sortOrder: 5 },
  { code: 'NONG_NGHIEP', name: 'Nông nghiệp - Sinh học', sortOrder: 6 },
  { code: 'KHTN', name: 'Khoa học tự nhiên', sortOrder: 7 },
  { code: 'GIAO_DUC', name: 'Giáo dục', sortOrder: 8 },
]

const units = [
  { code: 'KHOA_CNTT', name: 'Khoa Công nghệ thông tin', sortOrder: 1 },
  { code: 'KHOA_KINH_TE', name: 'Khoa Kinh tế', sortOrder: 2 },
  { code: 'KHOA_NGOAI_NGU', name: 'Khoa Ngoại ngữ', sortOrder: 3 },
  { code: 'KHOA_LUAT', name: 'Khoa Luật', sortOrder: 4 },
  { code: 'KHOA_Y', name: 'Khoa Y', sortOrder: 5 },
  { code: 'KHOA_DUOC', name: 'Khoa Dược', sortOrder: 6 },
  { code: 'KHOA_NONG_NGHIEP', name: 'Khoa Nông nghiệp', sortOrder: 7 },
  { code: 'VIEN_CNTT', name: 'Viện Nghiên cứu CNTT', sortOrder: 8 },
  { code: 'TRUNG_TAM_KHXH', name: 'Trung tâm Khoa học Xã hội', sortOrder: 9 },
  { code: 'PHONG_KH', name: 'Phòng Khoa học', sortOrder: 10 },
]

const levels = [
  { code: 'CO_SO', name: 'Cấp cơ sở', sortOrder: 1 },
  { code: 'TRUONG', name: 'Cấp Trường', sortOrder: 2 },
  { code: 'BO', name: 'Cấp Bộ', sortOrder: 3 },
  { code: 'NHA_NUOC', name: 'Cấp Nhà nước', sortOrder: 4 },
]

const ideaLevels = [
  { code: 'TRUONG_THUONG_NIEN', name: 'Cấp trường thường niên', sortOrder: 1 },
  { code: 'TRUONG_DAT_HANG', name: 'Cấp trường đặt hàng', sortOrder: 2 },
  { code: 'DAI_HOC_DA_NANG', name: 'Cấp Đại học Đà Nẵng', sortOrder: 3 },
  { code: 'BO_GDDT', name: 'Cấp Bộ GD&ĐT', sortOrder: 4 },
  { code: 'NHA_NUOC', name: 'Cấp Nhà nước', sortOrder: 5 },
  { code: 'NAFOSTED', name: 'NAFOSTED', sortOrder: 6 },
  { code: 'TINH_THANH_PHO', name: 'Cấp Tỉnh/Thành phố', sortOrder: 7 },
  { code: 'DOANH_NGHIEP', name: 'Doanh nghiệp', sortOrder: 8 },
]

const languages = [
  { code: 'ENGLISH', name: 'Tiếng Anh', sortOrder: 1 },
  { code: 'FRENCH', name: 'Tiếng Pháp', sortOrder: 2 },
  { code: 'GERMAN', name: 'Tiếng Đức', sortOrder: 3 },
  { code: 'JAPANESE', name: 'Tiếng Nhật', sortOrder: 4 },
  { code: 'CHINESE', name: 'Tiếng Trung', sortOrder: 5 },
  { code: 'KOREAN', name: 'Tiếng Hàn', sortOrder: 6 },
]

async function seedCatalogType(
  type: string,
  items: Array<{ code: string; name: string; sortOrder: number }>
) {
  for (const item of items) {
    const exists = await Catalog.query()
      .where('type', type)
      .where('code', item.code)
      .first()
    if (!exists) {
      await Catalog.create({
        type,
        code: item.code,
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: true,
      })
    }
  }
}

export default class CatalogSeeder extends BaseSeeder {
  async run() {
    await seedCatalogType('FIELD', fields)
    await seedCatalogType('UNIT', units)
    await seedCatalogType('PROJECT_LEVEL', levels)
    await seedCatalogType('IDEA_LEVEL', ideaLevels)
    await seedCatalogType('LANGUAGE', languages)
  }
}
