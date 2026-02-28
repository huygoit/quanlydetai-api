import { BaseSeeder } from '@adonisjs/lucid/seeders'

/**
 * Legacy seeder: bảng research_output_rules cũ đã bị DROP (chuẩn hóa DB).
 * Không chạy gì. Dữ liệu rule lấy từ 09_research_output_types_seeder.
 */
export default class ResearchOutputRulesSeeder extends BaseSeeder {
  async run() {
    // No-op: legacy table dropped, use research_output_types + research_output_rules (canonical)
  }
}
