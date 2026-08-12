import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Gộp 4 loại chức vụ catalog → 2 loại: POSITION | PARTY
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db
        .from('staff_positions')
        .whereIn('kind', ['MAIN', 'CONCURRENT', 'HIGHEST'])
        .update({ kind: 'POSITION' })
    })
  }

  async down() {
    // Không rollback — không phân biệt lại MAIN/CONCURRENT/HIGHEST
  }
}
