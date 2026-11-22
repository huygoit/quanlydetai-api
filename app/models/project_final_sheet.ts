import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { jsonAttr } from '#utils/json_attr'

export type SheetProductRow = {
  name: string
  key?: string
  planned?: string
  /** Tương thích phiếu cũ */
  actual?: string
  comment?: string
  /** Phiếu đánh giá HĐ mới: Đạt / Không đạt */
  soLuong?: 'DAT' | 'KHONG_DAT'
  chatLuong?: 'DAT' | 'KHONG_DAT'
  soLuongNote?: string
  chatLuongNote?: string
  note?: string
}

/** Phiếu nhận xét BM.12a của một phản biện. */
export default class ProjectFinalSheet extends BaseModel {
  static table = 'project_final_sheets'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare userId: number

  @column(jsonAttr<SheetProductRow[]>([]))
  declare productRows: SheetProductRow[]

  @column()
  declare volumeComment: string | null

  @column()
  declare qualityComment: string | null

  @column()
  declare reportComment: string | null

  @column()
  declare generalComment: string | null

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
