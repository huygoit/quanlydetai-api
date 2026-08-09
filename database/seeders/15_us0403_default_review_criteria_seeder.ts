import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProjectReviewCriteriaSet from '#models/project_review_criteria_set'
import ProjectReviewCriteriaItem from '#models/project_review_criteria_item'

/**
 * Bộ tiêu chí mặc định phản biện kín (US-04-03) — có thể sửa bởi ADMIN.
 * Không hard-code “năm tiêu chí × 20” cứng trong logic chấm.
 */
export default class extends BaseSeeder {
  async run() {
    let set = await ProjectReviewCriteriaSet.findBy('code', 'DEFAULT_BLIND_REVIEW')
    if (!set) {
      set = await ProjectReviewCriteriaSet.create({
        code: 'DEFAULT_BLIND_REVIEW',
        name: 'Bộ tiêu chí phản biện kín mặc định',
        description: 'Tiềm lực, cấp thiết, mục tiêu, phương pháp, khả thi/sản phẩm, kinh phí.',
        isActive: true,
        isDefault: true,
        failThreshold: 50,
        blindAggregation: true,
        minCommentLength: 50,
      })
    } else {
      set.isActive = true
      set.isDefault = true
      await set.save()
    }

    const items = [
      {
        code: 'TIEM_LUC',
        name: 'Tiềm lực thực hiện',
        description: 'Năng lực CNĐT, thành viên, điều kiện thực hiện',
        maxScore: 20,
        weight: 1,
        sortOrder: 1,
      },
      {
        code: 'CAP_THIET',
        name: 'Tính cấp thiết',
        description: 'Lý do chọn đề tài, ý nghĩa khoa học/thực tiễn',
        maxScore: 20,
        weight: 1,
        sortOrder: 2,
      },
      {
        code: 'MUC_TIEU',
        name: 'Mục tiêu',
        description: 'Mục tiêu rõ, phù hợp, đo được',
        maxScore: 15,
        weight: 1,
        sortOrder: 3,
      },
      {
        code: 'PHUONG_PHAP',
        name: 'Phương pháp nghiên cứu',
        description: 'Phương pháp phù hợp, khả thi',
        maxScore: 15,
        weight: 1,
        sortOrder: 4,
      },
      {
        code: 'KHA_THI_SP',
        name: 'Tính khả thi / sản phẩm',
        description: 'Tiến độ, sản phẩm dự kiến, khả năng hoàn thành',
        maxScore: 15,
        weight: 1,
        sortOrder: 5,
      },
      {
        code: 'KINH_PHI',
        name: 'Kinh phí',
        description: 'Hợp lý, khớp nội dung nghiên cứu',
        maxScore: 15,
        weight: 1,
        sortOrder: 6,
      },
    ]

    for (const it of items) {
      const exist = await ProjectReviewCriteriaItem.query()
        .where('criteria_set_id', set.id)
        .where('code', it.code)
        .first()
      if (exist) {
        exist.merge({ ...it, commentRequired: true })
        await exist.save()
      } else {
        await ProjectReviewCriteriaItem.create({
          criteriaSetId: set.id,
          ...it,
          commentRequired: true,
        })
      }
    }
  }
}
