import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'
import { validateByKind } from '#services/research_output_rule_validator_service'

const PARENT_CODE = 'QD_L2_1_4'
const HOURS_PER_POINT = 600

const LEAVES: Array<{ code: string; points: number; sortOrder: number }> = [
  { code: 'QD_R14_P025', points: 0.25, sortOrder: 2 },
  { code: 'QD_R14_P050', points: 0.5, sortOrder: 3 },
  { code: 'QD_R14_P075', points: 0.75, sortOrder: 4 },
  { code: 'QD_R14_P100', points: 1, sortOrder: 5 },
  { code: 'QD_R14_P125', points: 1.25, sortOrder: 6 },
]

const EVIDENCE =
  '- Trang bìa/mục lục tạp chí và toàn văn bài báo đã đăng.\n- Thông tin tạp chí, danh mục tính điểm HĐGSNN (tô màu làm nổi tên tạp chí).'

function formatPointsLabel(points: number): string {
  const s = String(points).replace('.', ',')
  return `Tạp chí quốc tế khác & tạp chí trong nước (${s})`
}

/**
 * Thêm 5 lá quy đổi điểm HĐGSNN (0.25 … 1.25) dưới QD_L2_1_4.
 */
export default class SeedDomesticJournalHdgsnnLeaves extends BaseCommand {
  static commandName = 'seed:domestic-journal-hdgsnn-leaves'
  static description =
    'Seed 5 lá Tạp chí QT/khác & trong nước theo mức điểm HĐGSNN dưới QD_L2_1_4'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const parent = await ResearchOutputType.query().where('code', PARENT_CODE).first()
    if (!parent) {
      this.logger.error(`Không tìm thấy nhánh cha code=${PARENT_CODE}`)
      this.exitCode = 1
      return
    }

    for (const row of LEAVES) {
      const name = formatPointsLabel(row.points)
      const hours = row.points * HOURS_PER_POINT

      let leaf = await ResearchOutputType.query().where('code', row.code).first()
      if (!leaf) {
        leaf = await ResearchOutputType.create({
          parentId: parent.id,
          code: row.code,
          name,
          level: 3,
          sortOrder: row.sortOrder,
          isActive: true,
          note: `Mức điểm HĐGSNN ${row.points} — seed ${new Date().toISOString().slice(0, 10)}`,
        })
        this.logger.success(`Tạo type ${row.code}`)
      } else {
        leaf.name = name
        leaf.parentId = parent.id
        leaf.level = 3
        leaf.sortOrder = row.sortOrder
        leaf.isActive = true
        await leaf.save()
        this.logger.info(`Cập nhật type ${row.code}`)
      }

      const rulePayload = {
        ruleKind: 'FIXED' as const,
        pointsValue: row.points,
        hoursValue: hours,
        hoursMultiplierVar: null,
        hoursBonus: null,
        meta: { source: 'HDGSNN_TIER', points: row.points, hours_per_point: HOURS_PER_POINT },
        evidenceRequirements: EVIDENCE,
      }
      validateByKind(rulePayload)

      let rule = await ResearchOutputRule.query().where('type_id', leaf.id).first()
      if (!rule) {
        await ResearchOutputRule.create({
          typeId: leaf.id,
          ...rulePayload,
        })
        this.logger.success(`  + rule FIXED ${row.points} điểm → ${hours} giờ`)
      } else {
        rule.merge(rulePayload)
        await rule.save()
        this.logger.info(`  + cập nhật rule`)
      }
    }

    this.logger.info('Hoàn tất.')
  }
}
