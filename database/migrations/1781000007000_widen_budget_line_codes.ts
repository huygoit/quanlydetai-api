import { BaseSchema } from '@adonisjs/lucid/schema'

/** Nới varchar mã khoản chi — chuẩn TM (TU_DANH_GIA, TU_VAN_SHTT, …) dài hơn MUC_*. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_budget_lines', (t) => {
      t.string('code', 32).alter()
    })
    this.schema.alterTable('project_budget_entries', (t) => {
      t.string('line_code', 32).alter()
    })
    this.schema.alterTable('project_payment_requests', (t) => {
      t.string('line_code', 32).alter()
    })
    this.schema.alterTable('project_procurements', (t) => {
      t.string('line_code', 32).alter()
    })
  }

  async down() {
    // Không thu hẹp lại — tránh cắt dữ liệu mã dài
  }
}
