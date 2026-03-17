import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

type StartupFieldSeed = {
  code: string
  name: string
  description: string | null
  sortOrder: number
}

const STARTUP_FIELDS: StartupFieldSeed[] = [
  {
    code: 'STARTUP_TOURISM_CULTURE_HERITAGE',
    name: 'Du lịch, Văn hóa & Di sản',
    description: 'Gồm Du lịch, Văn hóa, Di sản, Nghệ thuật',
    sortOrder: 1,
  },
  {
    code: 'STARTUP_EDTECH_EDUCATION',
    name: 'Giáo dục & Công nghệ giáo dục',
    description: 'Gồm EdTech, Giáo dục',
    sortOrder: 2,
  },
  {
    code: 'STARTUP_IT_AI_DIGITAL',
    name: 'Công nghệ thông tin & Trí tuệ nhân tạo',
    description: 'Gồm CNTT, AI, Số hóa',
    sortOrder: 3,
  },
  {
    code: 'STARTUP_ENV_AGRI_BIO',
    name: 'Môi trường, Nông nghiệp & Sinh học',
    description: 'Gồm Môi trường, Sinh học, AgriTech',
    sortOrder: 4,
  },
  {
    code: 'STARTUP_HEALTH_MEDICAL_FOOD',
    name: 'Y tế, Sức khỏe & Thực phẩm',
    description: null,
    sortOrder: 5,
  },
  {
    code: 'STARTUP_PSYCHOLOGY_SOCIAL_CREATIVE',
    name: 'Tâm lý & Sáng tạo xã hội',
    description: null,
    sortOrder: 6,
  },
  {
    code: 'STARTUP_UNCLASSIFIED',
    name: 'Hồ sơ chưa phân loại/Trống',
    description: null,
    sortOrder: 7,
  },
]

/**
 * Seed danh mục lĩnh vực startup.
 * Idempotent theo code: có thì update, chưa có thì insert.
 */
export default class ResearchStartupFieldsSeeder extends BaseSeeder {
  async run() {
    for (const item of STARTUP_FIELDS) {
      const exists = await db
        .from('research_startup_fields')
        .where('code', item.code)
        .first()

      if (exists) {
        await db
          .from('research_startup_fields')
          .where('code', item.code)
          .update({
            name: item.name,
            type: 'STARTUP',
            description: item.description,
            is_active: true,
            sort_order: item.sortOrder,
            updated_at: new Date(),
          })
      } else {
        await db.table('research_startup_fields').insert({
          code: item.code,
          name: item.name,
          type: 'STARTUP',
          parent_id: null,
          description: item.description,
          is_active: true,
          sort_order: item.sortOrder,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }
    }
  }
}
