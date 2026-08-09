import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mỗi kỳ thông báo (CFP) chỉ có tối đa 1 phiên xét chọn.
 */
export default class extends BaseSchema {
  protected tableName = 'proposal_selection_sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['call_for_proposal_id'], 'proposal_selection_sessions_cfp_unique')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['call_for_proposal_id'], 'proposal_selection_sessions_cfp_unique')
    })
  }
}
