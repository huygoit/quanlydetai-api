import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type ContractTemplateStatus = 'ACTIVE' | 'INACTIVE'
export type ContractTemplateType = 'HOP_DONG' | 'THANH_LY' | 'THONG_BAO'

/** Giá trị cố định của một mẫu thông báo, điền vào {{biến}} khi xuất file. */
export type ThongBaoMergeConfig = {
  ky_hieu: string
  noi_nhan: string
  tham_quyen_ky: string
  ho_ten_nguoi_ky: string
  /** Số thông báo mới nhất đã được phê duyệt. Bản xem/tải dùng số này + 1. */
  so_moi_nhat: number
}

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

  /** HOP_DONG | THANH_LY | THONG_BAO */
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

  @column({
    prepare: (value: ThongBaoMergeConfig | null) => (value == null ? null : JSON.stringify(value)),
    consume: (value: string | ThongBaoMergeConfig | null) => {
      const trong = {
        ky_hieu: '',
        noi_nhan: '',
        tham_quyen_ky: '',
        ho_ten_nguoi_ky: '',
        so_moi_nhat: 0,
      }
      let raw: Record<string, string> | null = null
      if (value == null) return trong
      if (typeof value === 'object') raw = value as unknown as Record<string, string>
      else {
        try {
          const parsed = JSON.parse(value)
          if (parsed && typeof parsed === 'object') raw = parsed
        } catch {
          raw = null
        }
      }
      if (!raw) return trong
      const so = Number(raw.so_moi_nhat)
      return {
        ky_hieu: String(raw.ky_hieu || raw.ky_hieu_thong_bao || ''),
        noi_nhan: String(raw.noi_nhan || ''),
        tham_quyen_ky: String(raw.tham_quyen_ky || ''),
        ho_ten_nguoi_ky: String(raw.ho_ten_nguoi_ky || ''),
        so_moi_nhat: Number.isFinite(so) && so > 0 ? Math.floor(so) : 0,
      }
    },
  })
  declare mergeConfig: ThongBaoMergeConfig

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
