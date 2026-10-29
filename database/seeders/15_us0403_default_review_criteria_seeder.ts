import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProjectReviewCriteriaSet from '#models/project_review_criteria_set'
import ProjectReviewCriteriaItem from '#models/project_review_criteria_item'

/**
 * Bộ tiêu chí BM-02.09 — Phiếu đánh giá hồ sơ xét tài trợ/đặt hàng/tuyển chọn/giao trực tiếp.
 * Phiếu cũ đã snapshot vẫn giữ tiêu chí lúc tạo; phiếu mới lấy bộ mặc định này.
 */
export default class extends BaseSeeder {
  async run() {
    // Bỏ mặc định bộ cũ (nếu còn)
    const old = await ProjectReviewCriteriaSet.findBy('code', 'DEFAULT_BLIND_REVIEW')
    if (old) {
      old.isDefault = false
      old.isActive = false
      old.name = 'Bộ tiêu chí phản biện kín (cũ)'
      await old.save()
    }

    let set = await ProjectReviewCriteriaSet.findBy('code', 'BM_02_09')
    if (!set) {
      set = await ProjectReviewCriteriaSet.create({
        code: 'BM_02_09',
        name: 'BM-02.09 — Phiếu đánh giá hồ sơ xét tài trợ/đặt hàng/tuyển chọn/giao trực tiếp',
        description:
          '8 tiêu chí / 100 điểm theo mẫu BM-02.09. Nhận xét chung ở cuối phiếu, không bắt buộc nhận xét từng tiêu chí.',
        isActive: true,
        isDefault: true,
        failThreshold: 50,
        blindAggregation: true,
        minCommentLength: 20,
      })
    } else {
      set.merge({
        name: 'BM-02.09 — Phiếu đánh giá hồ sơ xét tài trợ/đặt hàng/tuyển chọn/giao trực tiếp',
        isActive: true,
        isDefault: true,
        failThreshold: 50,
        blindAggregation: true,
        minCommentLength: 20,
      })
      await set.save()
    }

    const items = [
      {
        code: 'PHU_HOP_MUC_TIEU',
        name: 'Sự phù hợp với mục tiêu, yêu cầu nhiệm vụ',
        maxScore: 15,
        sortOrder: 1,
      },
      {
        code: 'KHOA_HOC_MOI',
        name: 'Tính khoa học, tính mới và sáng tạo',
        maxScore: 15,
        sortOrder: 2,
      },
      {
        code: 'NOI_DUNG_PP',
        name: 'Nội dung và phương pháp thực hiện',
        maxScore: 15,
        sortOrder: 3,
      },
      {
        code: 'SAN_PHAM_CL',
        name: 'Sản phẩm và chỉ tiêu chất lượng',
        maxScore: 15,
        sortOrder: 4,
      },
      {
        code: 'KHA_THI_TIEN_DO',
        name: 'Tính khả thi và tiến độ',
        maxScore: 10,
        sortOrder: 5,
      },
      {
        code: 'NANG_LUC_NHOM',
        name: 'Năng lực của chủ nhiệm và nhóm thực hiện',
        maxScore: 10,
        sortOrder: 6,
      },
      {
        code: 'CSVC_NGUON_LUC',
        name: 'Cơ sở vật chất và nguồn lực',
        maxScore: 10,
        sortOrder: 7,
      },
      {
        code: 'HIEU_QUA_CG',
        name: 'Hiệu quả, khả năng ứng dụng/chuyển giao',
        maxScore: 10,
        sortOrder: 8,
      },
    ]

    const keepCodes = new Set(items.map((i) => i.code))
    const existing = await ProjectReviewCriteriaItem.query().where('criteria_set_id', set.id)
    for (const row of existing) {
      if (!keepCodes.has(row.code)) await row.delete()
    }

    for (const it of items) {
      const row = await ProjectReviewCriteriaItem.query()
        .where('criteria_set_id', set.id)
        .where('code', it.code)
        .first()
      if (row) {
        row.merge({
          name: it.name,
          description: null,
          maxScore: it.maxScore,
          weight: 1,
          sortOrder: it.sortOrder,
          // BM-02.09: nhận xét ở cuối phiếu, không bắt buộc từng tiêu chí
          commentRequired: false,
        })
        await row.save()
      } else {
        await ProjectReviewCriteriaItem.create({
          criteriaSetId: set.id,
          code: it.code,
          name: it.name,
          description: null,
          maxScore: it.maxScore,
          weight: 1,
          sortOrder: it.sortOrder,
          commentRequired: false,
        })
      }
    }
  }
}
