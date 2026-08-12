import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ResearchOutputType from '#models/research_output_type'
import ProjectProcessType from '#models/project_process_type'
import ProjectProposalMember from '#models/project_proposal_member'

/** Trạng thái đề xuất đề tài (US-03-02 / US-03-03) */
export type ProjectProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'CHO_PKH'
  | 'YEU_CAU_BS'
  | 'HOP_LE'
  | 'DA_LOAI'
  | 'DUOC_CHON'
  | 'DIEU_CHINH'
  | 'KHONG_CHON'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  /** @deprecated đã migrate → CHO_PKH */
  | 'UNIT_REVIEWED'

/** Cấp đề tài */
export type ProjectProposalLevel = 'CO_SO' | 'TRUONG' | 'BO' | 'NHA_NUOC'

/** Mức độ ưu tiên Phòng KH */
export type SciDeptPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export default class ProjectProposal extends BaseModel {
  static table = 'project_proposals'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare field: string

  @column()
  declare level: ProjectProposalLevel

  @column()
  declare year: number

  @column()
  declare durationMonths: number

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare keywords: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare ownerId: number

  @column()
  declare ownerName: string

  @column()
  declare ownerEmail: string | null

  @column()
  declare ownerUnit: string

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) =>
      typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : [],
  })
  declare coAuthors: string[]

  @column()
  declare objectives: string

  @column()
  declare summary: string

  @column()
  declare contentOutline: string | null

  @column()
  declare expectedResults: string | null

  @column()
  declare applicationPotential: string | null

  @column()
  declare requestedBudgetTotal: number | null

  @column()
  declare requestedBudgetDetail: string | null

  @column()
  declare status: ProjectProposalStatus

  @column()
  declare academicYear: string | null

  /** Xếp loại nghiệm thu: EXCELLENT, PASS_ON_TIME, PASS_LATE */
  @column()
  declare acceptanceGrade: string | null

  /** Hệ số C phục vụ tính giờ (MULTIPLY_C) */
  @column()
  declare cFactor: number | null

  @column()
  declare unitComment: string | null

  @column()
  declare unitApproved: boolean | null

  @column()
  declare sciDeptComment: string | null

  @column()
  declare sciDeptPriority: SciDeptPriority | null

  /** Lá loại kết quả NCKH (KPI theo rule import). */
  @column()
  declare researchOutputTypeId: number | null

  /** Hướng nghiên cứu chính (tuỳ chọn — user story nộp đề tài) */
  @column()
  declare researchDirection: string | null

  /** URL file biểu mẫu đề xuất (PDF/DOCX) */
  @column()
  declare attachmentUrl: string | null

  /** Kỳ thông báo tuyển chọn gắn với đề xuất */
  @column()
  declare callForProposalId: number | null

  /** Loại quy trình đề tài (QT-I … QT-V) */
  @column()
  declare projectProcessTypeId: number | null

  /** Ý tưởng nguồn (khi tạo tự động sau phê duyệt đặt hàng) */
  @column()
  declare sourceIdeaId: number | null

  /** Hạn GV bổ sung hồ sơ (PKH yêu cầu) */
  @column.dateTime()
  declare supplementDueAt: DateTime | null

  /** Tag quá hạn bổ sung (lazy cập nhật khi đọc API) */
  @column()
  declare supplementOverdue: boolean

  /** Ghi chú / yêu cầu mới nhất từ PKH */
  @column()
  declare pkhComment: string | null

  /** Được phép soạn thuyết minh (sau BGH: chỉ DUOC_CHON) */
  @column()
  declare canWriteOutline: boolean

  /** Nội dung điều chỉnh từ HĐ (khi DIEU_CHINH) */
  @column()
  declare councilAdjustmentNote: string | null

  /** Thời điểm thông báo yêu cầu điều chỉnh (BGH duyệt / email stub) */
  @column.dateTime()
  declare adjustmentNotifiedAt: DateTime | null

  /** Hạn GV nộp lại điều chỉnh (5 ngày làm việc) */
  @column.dateTime()
  declare adjustmentDueAt: DateTime | null

  /** Tag quá hạn điều chỉnh */
  @column()
  declare adjustmentOverdue: boolean

  /** Đã gửi nhắc ngày làm việc thứ 4 */
  @column.dateTime()
  declare adjustmentReminderSentAt: DateTime | null

  /** Ghi chú giải trình lần nộp điều chỉnh gần nhất */
  @column()
  declare adjustmentExplanation: string | null

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @belongsTo(() => ResearchOutputType, { foreignKey: 'researchOutputTypeId' })
  declare researchOutputType: BelongsTo<typeof ResearchOutputType>

  @belongsTo(() => ProjectProcessType, { foreignKey: 'projectProcessTypeId' })
  declare projectProcessType: BelongsTo<typeof ProjectProcessType>

  @hasMany(() => ProjectProposalMember, { foreignKey: 'projectProposalId' })
  declare members: HasMany<typeof ProjectProposalMember>

  /**
   * Sinh mã đề xuất: ĐT-{year}-{sequence 3 chữ số}
   */
  static async generateCode(year: number): Promise<string> {
    const last = await ProjectProposal.query()
      .where('code', 'like', `ĐT-${year}-%`)
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = lastSeq + 1
    }
    return `ĐT-${year}-${String(seq).padStart(3, '0')}`
  }
}
