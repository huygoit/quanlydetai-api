import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

type ResearchFieldSeed = {
  code: string
  name: string
  sortOrder: number
}

const RESEARCH_FIELDS: ResearchFieldSeed[] = [
  {
    code: 'RESEARCH_EDU_TOURISM_SERVICE_ART',
    name: 'Giáo dục, du lịch, dịch vụ, văn hóa/văn hoá nghệ thuật',
    sortOrder: 1,
  },
  {
    code: 'RESEARCH_AI_BLOCKCHAIN_SMART_CITY',
    name: 'Công nghệ AI, Blockchain, thành phố thông minh',
    sortOrder: 2,
  },
  {
    code: 'RESEARCH_AI_TOURISM_SMART_SERVICE',
    name: 'Công nghệ AI, du lịch, dịch vụ thông minh',
    sortOrder: 3,
  },
  {
    code: 'RESEARCH_HEALTH_FOOD_SAFETY',
    name: 'Chăm sóc sức khỏe/sức khoẻ, an toàn thực phẩm',
    sortOrder: 4,
  },
  {
    code: 'RESEARCH_AGRI_FORESTRY_FISHERY',
    name: 'Nông, lâm, ngư nghiệp',
    sortOrder: 5,
  },
  {
    code: 'RESEARCH_INDUSTRY_MANUFACTURING_NEW_ENERGY',
    name: 'Công nghiệp, chế tạo sản phẩm, năng lượng mới',
    sortOrder: 6,
  },
  {
    code: 'RESEARCH_HEALTH_AND_FOOD_SAFETY',
    name: 'Sức khỏe và an toàn thực phẩm',
    sortOrder: 7,
  },
  {
    code: 'RESEARCH_MANUFACTURING_AND_HEALTHCARE',
    name: 'Chế tạo sản phẩm, chăm sóc sức khỏe',
    sortOrder: 8,
  },
  {
    code: 'RESEARCH_TOURISM',
    name: 'Du lịch',
    sortOrder: 9,
  },
  {
    code: 'RESEARCH_EDUCATION',
    name: 'Giáo dục',
    sortOrder: 10,
  },
  {
    code: 'RESEARCH_HEALTHCARE_AND_SERVICE',
    name: 'Chăm sóc sức khỏe và dịch vụ',
    sortOrder: 11,
  },
]

export default class ResearchStartupFieldsResearchSeeder extends BaseSeeder {
  async run() {
    for (const item of RESEARCH_FIELDS) {
      const existed = await db
        .from('research_startup_fields')
        .where('code', item.code)
        .first()

      if (existed) {
        await db
          .from('research_startup_fields')
          .where('code', item.code)
          .update({
            name: item.name,
            type: 'RESEARCH',
            parent_id: null,
            is_active: true,
            sort_order: item.sortOrder,
            updated_at: new Date(),
          })
      } else {
        await db.table('research_startup_fields').insert({
          code: item.code,
          name: item.name,
          type: 'RESEARCH',
          parent_id: null,
          description: null,
          is_active: true,
          sort_order: item.sortOrder,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }
    }
  }
}
