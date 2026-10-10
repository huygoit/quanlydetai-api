import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Tài sản phát sinh từ mục TSCĐ, dùng cho BM.14 Điều 3. */
export default class ProjectAsset extends BaseModel {
  static table = 'project_assets'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare procurementId: number | null

  @column()
  declare name: string

  @column()
  declare quantity: string | null

  @column()
  declare amount: number

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
