import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import ContractTemplate from '#models/contract_template'

export type ProjectContractStatus =
  | 'HOP_DONG_DRAFT'
  | 'HOP_DONG_CHO_CNNV'
  | 'HOP_DONG_CHO_KY'
  | 'HOP_DONG_CHO_PHAT_HANH'
  | 'HOP_DONG_DA_KY'

export type ContractSignMode = 'ONLINE' | 'GIAY'

/**
 * Hợp đồng nhiệm vụ (BM.06) — Module 5.
 */
export default class ProjectContract extends BaseModel {
  static table = 'project_contracts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare contractTemplateId: number | null

  @column()
  declare status: ProjectContractStatus

  /** ONLINE: bấm xác nhận. GIAY: bắt buộc file scan bản giấy. */
  @column()
  declare signMode: ContractSignMode

  @column()
  declare contractNo: string | null

  @column()
  declare fileName: string

  @column()
  declare storedFileName: string

  @column()
  declare fileUrl: string

  @column()
  declare fileSize: number | null

  @column({
    prepare: (v: Record<string, string> | null) => (v == null ? null : JSON.stringify(v)),
    consume: (v: string | Record<string, string> | null) => {
      if (v == null) return {}
      if (typeof v === 'object') return v
      try {
        const p = JSON.parse(v)
        return p && typeof p === 'object' ? p : {}
      } catch {
        return {}
      }
    },
  })
  declare mergePayload: Record<string, string>

  @column()
  declare version: number

  @column()
  declare generatedBy: number | null

  @column.dateTime()
  declare generatedAt: DateTime | null

  @column()
  declare note: string | null

  @column()
  declare externalContractNo: string | null

  @column()
  declare externalAgency: string | null

  @column()
  declare externalFileUrl: string | null

  @column()
  declare returnReason: string | null

  @column.dateTime()
  declare cnnvConfirmedAt: DateTime | null

  @column()
  declare cnnvConfirmedBy: number | null

  @column.dateTime()
  declare bghSignedAt: DateTime | null

  @column()
  declare bghSignedBy: number | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column()
  declare publishedBy: number | null

  @column()
  declare issueNo: string | null

  @column.dateTime()
  declare cnnvSignedAt: DateTime | null

  @column()
  declare cnnvSignedBy: number | null

  @column()
  declare signedFileUrl: string | null

  @column.dateTime()
  declare effectiveAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => ContractTemplate, { foreignKey: 'contractTemplateId' })
  declare template: BelongsTo<typeof ContractTemplate>
}
