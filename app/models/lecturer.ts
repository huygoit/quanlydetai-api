import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Lecturer extends BaseModel {
  static table = 'lecturers'

  @column({ isPrimary: true })
  declare id: number
}
