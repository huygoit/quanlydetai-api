import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'

/**
 * Seed cây loại kết quả NCKH + leaf codes cho mapping (WOS_Q1, SCOPUS_Q1, DOMESTIC_HDGSNN, ...)
 * và rule FIXED/MULTIPLY_C. Phụ lục đầy đủ có thể bổ sung sau.
 */
export default class ResearchOutputTypesSeeder extends BaseSeeder {
  async run() {
    const existing = await ResearchOutputType.query().limit(1).first()
    if (existing) return

    // Level 1
    const level1Data = [
      { code: 'I', name: 'Công bố khoa học', sortOrder: 1 },
      { code: 'II', name: 'Sách, giáo trình', sortOrder: 2 },
      { code: 'III', name: 'Bằng độc quyền sáng chế', sortOrder: 3 },
      { code: 'IV', name: 'Chuyển giao công nghệ', sortOrder: 4 },
      { code: 'V', name: 'Kết quả nghiên cứu khác', sortOrder: 5 },
    ]
    const level1Ids: number[] = []
    for (const row of level1Data) {
      const t = await ResearchOutputType.create({
        parentId: null,
        code: row.code,
        name: row.name,
        level: 1,
        sortOrder: row.sortOrder,
        isActive: true,
        note: null,
      })
      level1Ids.push(t.id)
    }

    const parentI = level1Ids[0]
    const level2First = await ResearchOutputType.create({
      parentId: parentI,
      code: 'I.1',
      name: 'Bài báo tạp chí',
      level: 2,
      sortOrder: 1,
      isActive: true,
      note: null,
    })

    // Leaf codes công bố theo Phụ lục 1883/QĐ-ĐHSP.
    const pubLeaves: Array<{
      code: string
      name: string
      hours: number
      points: number | null
      ruleKind: 'FIXED' | 'HDGSNN_POINTS_TO_HOURS'
      sortOrder: number
    }> = [
      { code: 'PUB_WOS_Q1', name: 'Bài báo WOS Q1', hours: 1800, points: 3.0, ruleKind: 'FIXED', sortOrder: 1 },
      { code: 'PUB_WOS_Q2', name: 'Bài báo WOS Q2', hours: 1650, points: 2.75, ruleKind: 'FIXED', sortOrder: 2 },
      { code: 'PUB_WOS_Q3', name: 'Bài báo WOS Q3', hours: 1500, points: 2.5, ruleKind: 'FIXED', sortOrder: 3 },
      { code: 'PUB_WOS_Q4', name: 'Bài báo WOS Q4', hours: 1350, points: 2.25, ruleKind: 'FIXED', sortOrder: 4 },
      { code: 'PUB_WOS_NO_Q', name: 'Bài báo WOS không Q', hours: 1200, points: 2.0, ruleKind: 'FIXED', sortOrder: 5 },
      { code: 'PUB_SCOPUS_Q1', name: 'Bài báo Scopus Q1', hours: 1500, points: 2.5, ruleKind: 'FIXED', sortOrder: 6 },
      { code: 'PUB_SCOPUS_Q2', name: 'Bài báo Scopus Q2', hours: 1350, points: 2.25, ruleKind: 'FIXED', sortOrder: 7 },
      { code: 'PUB_SCOPUS_Q3', name: 'Bài báo Scopus Q3', hours: 1200, points: 2.0, ruleKind: 'FIXED', sortOrder: 8 },
      { code: 'PUB_SCOPUS_Q4', name: 'Bài báo Scopus Q4', hours: 1050, points: 1.75, ruleKind: 'FIXED', sortOrder: 9 },
      { code: 'PUB_SCOPUS_NO_Q', name: 'Bài báo Scopus không Q', hours: 900, points: 1.5, ruleKind: 'FIXED', sortOrder: 10 },
      {
        code: 'PUB_DOMESTIC_HDGNN',
        name: 'Tạp chí trong danh mục HĐGSNN',
        hours: 600,
        points: null,
        ruleKind: 'HDGSNN_POINTS_TO_HOURS',
        sortOrder: 11,
      },
      { code: 'PUB_CONF_ISBN', name: 'Hội thảo có ISBN', hours: 300, points: 0.5, ruleKind: 'FIXED', sortOrder: 12 },
    ]
    for (const row of pubLeaves) {
      const leaf = await ResearchOutputType.create({
        parentId: level2First.id,
        code: row.code,
        name: row.name,
        level: 3,
        sortOrder: row.sortOrder,
        isActive: true,
        note: null,
      })
      await ResearchOutputRule.create({
        typeId: leaf.id,
        ruleKind: row.ruleKind,
        pointsValue: row.points,
        hoursValue: row.hours,
        hoursMultiplierVar: null,
        hoursBonus: null,
        meta: {},
        evidenceRequirements: null,
      })
    }

    // Project leaves cho mapProjectToTypeId
    const projectParent = await ResearchOutputType.create({
      parentId: level1Ids[0],
      code: 'I.6',
      name: 'Đề tài nghiệm thu',
      level: 2,
      sortOrder: 6,
      isActive: true,
      note: null,
    })
    const projectLeaves: Array<{ code: string; name: string; hours: number }> = [
      { code: 'PROJECT_ACCEPTED_NATIONAL', name: 'Đề tài cấp Nhà nước', hours: 600 },
      { code: 'PROJECT_ACCEPTED_MINISTRY', name: 'Đề tài cấp Bộ', hours: 450 },
      { code: 'PROJECT_ACCEPTED_UNIVERSITY', name: 'Đề tài cấp Trường', hours: 300 },
    ]
    for (let i = 0; i < projectLeaves.length; i++) {
      const row = projectLeaves[i]
      const leaf = await ResearchOutputType.create({
        parentId: projectParent.id,
        code: row.code,
        name: row.name,
        level: 3,
        sortOrder: i + 1,
        isActive: true,
        note: null,
      })
      await ResearchOutputRule.create({
        typeId: leaf.id,
        ruleKind: 'MULTIPLY_C',
        pointsValue: 100,
        hoursValue: row.hours,
        hoursMultiplierVar: 'c',
        hoursBonus: null,
        meta: { c_map: { EXCELLENT: 1.1, PASS_ON_TIME: 1.0, PASS_LATE: 0.5 } },
        evidenceRequirements: null,
      })
    }
  }
}
