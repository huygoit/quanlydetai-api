import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type ContractTemplateStatus = 'ACTIVE' | 'INACTIVE'
export type ContractTemplateType = 'HOP_DONG' | 'THANH_LY'

/**
 * Mẫu DOCX biểu mẫu (hợp đồng BM.06, biên bản thanh lý, …).
 */
export default class ContractTemplate extends BaseModel {
  static table = 'contract_templates'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  /** HOP_DONG | THANH_LY */
  @column()
  declare templateType: ContractTemplateType

  /** Mã biểu mẫu nội bộ (vd BM06) — tùy chọn */
  @column()
  declare formCode: string

  @column()
  declare fileName: string

  @column()
  declare storedFileName: string

  @column()
  declare fileUrl: string

  @column()
  declare fileSize: number | null

  @column({
    prepare: (value: string[] | null) => (value == null ? null : JSON.stringify(value)),
    consume: (value: string | string[] | null) => {
      if (value == null) return []
      if (Array.isArray(value)) return value
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    },
  })
  declare detectedVariables: string[]

  @column()
  declare isDefault: boolean

  @column()
  declare status: ContractTemplateStatus

  @column()
  declare version: number

  @column()
  declare uploadedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
