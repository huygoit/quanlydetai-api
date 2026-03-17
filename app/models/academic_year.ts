import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AcademicYear extends BaseModel {
  static table = 'academic_years'

  @column({ isPrimary: true })
  declare id: number
}
