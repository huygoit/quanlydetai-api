import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'
import type { CouncilRole, FinalClassification } from '#constants/module56'
import type { StoredFile } from '#models/project_progress_report'

export type CouncilMember = {
  userId: number
  fullName: string
  email: string | null
  role: CouncilRole
}

export type FinalProduct = {
  name: string
  fileUrl: string | null
  link: string | null
}

export type MinutesBody = {
  discussion: string
  volume: string
  quality: string
  recommendation: string
  recommendationLines: string[]
  presentUserIds: number[]
  absentUserIds: number[]
  productMarks: { name: string; met: boolean }[]
}

export type ExplanationItem = { recommendation: string; response: string }
export type SettlementLine = { code: string; declaredAmount: number }

/**
 * Hồ sơ đánh giá cuối kỳ của một nhiệm vụ.
 * Trạng thái vòng đời nằm ở project_outlines.execution_status.
 */
export default class ProjectFinalCase extends BaseModel {
  static table = 'project_final_cases'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column.dateTime()
  declare notifiedAt: DateTime | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column(jsonAttr<StoredFile | null>(null))
  declare summaryFile: StoredFile | null

  @column(jsonAttr<StoredFile | null>(null))
  declare briefFile: StoredFile | null

  @column()
  declare briefPagesOk: boolean

  @column()
  declare resultVi: string | null

  @column()
  declare resultEn: string | null

  @column(jsonAttr<FinalProduct[]>([]))
  declare products: FinalProduct[]

  @column(jsonAttr<StoredFile | null>(null))
  declare councilFile: StoredFile | null

  @column()
  declare publicationsNote: string | null

  @column()
  declare pkhNote: string | null

  @column.dateTime()
  declare meetingAt: DateTime | null

  @column()
  declare meetingLocation: string | null

  @column.dateTime()
  declare reviewDeadline: DateTime | null

  @column(jsonAttr<CouncilMember[]>([]))
  declare councilMembers: CouncilMember[]

  @column(jsonAttr<MinutesBody | null>(null))
  declare minutes: MinutesBody | null

  @column()
  declare minutesLocked: boolean

  @column()
  declare minutesFileName: string | null

  @column()
  declare minutesStoredFileName: string | null

  @column()
  declare minutesFileUrl: string | null

  @column()
  declare classification: FinalClassification | null

  @column(jsonAttr<ExplanationItem[]>([]))
  declare explanationItems: ExplanationItem[]

  @column()
  declare explanationStatus: string | null

  @column.dateTime()
  declare explanationDeadline: DateTime | null

  @column.dateTime()
  declare explanationStartedAt: DateTime | null

  @column(jsonAttr<StoredFile | null>(null))
  declare explanationReportFile: StoredFile | null

  @column()
  declare explanationReturnReason: string | null

  // snakeCase tách thành reminded_day_10, lệch cột thật reminded_day10
  @column({ columnName: 'reminded_day10' })
  declare remindedDay10: boolean

  @column({ columnName: 'reminded_day13' })
  declare remindedDay13: boolean

  @column.dateTime()
  declare secretaryConfirmedAt: DateTime | null

  @column.dateTime()
  declare chairConfirmedAt: DateTime | null

  @column()
  declare settlementStatus: string | null

  @column(jsonAttr<SettlementLine[]>([]))
  declare settlementLines: SettlementLine[]

  @column(jsonAttr<StoredFile[]>([]))
  declare settlementFiles: StoredFile[]

  @column()
  declare varianceAck: boolean

  @column()
  declare varianceReason: string | null

  @column.date()
  declare settlementDate: DateTime | null

  @column()
  declare settlementReturnReason: string | null

  @column()
  declare liquidationStatus: string | null

  @column()
  declare surplusHandling: 'HOAN_TRA' | 'KHONG_PHAT_SINH' | null

  @column()
  declare recognitionFileUrl: string | null

  @column()
  declare liquidationFileName: string | null

  @column()
  declare liquidationStoredFileName: string | null

  @column()
  declare liquidationFileUrl: string | null

  @column()
  declare liquidationReturnReason: string | null

  @column.dateTime()
  declare liqBghSignedAt: DateTime | null

  @column.dateTime()
  declare liqPublishedAt: DateTime | null

  @column()
  declare liqIssueNo: string | null

  @column.dateTime()
  declare liqCnnvSignedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
