import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Faculty extends BaseModel {
  static table = 'faculties'

  @column({ isPrimary: true })
  declare id: number
}
