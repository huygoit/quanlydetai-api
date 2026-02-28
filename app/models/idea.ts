import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type IdeaStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'APPROVED_INTERNAL'
  | 'PROPOSED_FOR_ORDER'
  | 'APPROVED_FOR_ORDER'
  | 'REJECTED'

export type IdeaPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type RejectedStage = 'PHONG_KH_SO_LOAI' | 'HOI_DONG_DE_XUAT' | 'LANH_DAO_PHE_DUYET'

const SUITABLE_LEVELS = [
  'TRUONG_THUONG_NIEN',
  'TRUONG_DAT_HANG',
  'DAI_HOC_DA_NANG',
  'BO_GDDT',
  'NHA_NUOC',
  'NAFOSTED',
  'TINH_THANH_PHO',
  'DOANH_NGHIEP',
] as const

export default class Idea extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare title: string

  @column()
  declare summary: string

  @column()
  declare field: string

  @column({
    prepare: (v: string[] | null) => (v == null ? '[]' : JSON.stringify(v)),
    consume: (v: string | unknown) => (typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []),
  })
  declare suitableLevels: string[]

  @column()
  declare ownerId: number

  @column()
  declare ownerName: string

  @column()
  declare ownerUnit: string

  @column()
  declare status: IdeaStatus

  @column()
  declare priority: IdeaPriority | null

  @column()
  declare noteForReview: string | null

  @column()
  declare rejectedStage: RejectedStage | null

  @column()
  declare rejectedReason: string | null

  @column()
  declare rejectedByRole: string | null

  @column.dateTime()
  declare rejectedAt: DateTime | null

  @column()
  declare linkedProjectId: string | null

  @column()
  declare councilSessionId: number | null

  @column()
  declare councilAvgWeightedScore: number | null

  @column()
  declare councilAvgNoveltyScore: number | null

  @column()
  declare councilAvgFeasibilityScore: number | null

  @column()
  declare councilAvgAlignmentScore: number | null

  @column()
  declare councilAvgAuthorCapacityScore: number | null

  @column()
  declare councilSubmittedCount: number | null

  @column()
  declare councilMemberCount: number | null

  @column()
  declare councilRecommendation: string | null

  @column.dateTime()
  declare councilScoredAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  static suitableLevelsList = SUITABLE_LEVELS

  /**
   * Sinh mã ý tưởng: YT-{year}-{sequence 3 chữ số}
   */
  static async generateCode(): Promise<string> {
    const year = new Date().getFullYear()
    const last = await Idea.query()
      .whereRaw('code LIKE ?', [`YT-${year}-%`])
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last) {
      const parts = last.code.split('-')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = lastSeq + 1
    }
    return `YT-${year}-${String(seq).padStart(3, '0')}`
  }
}
