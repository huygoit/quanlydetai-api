import db from '@adonisjs/lucid/services/db'
import ProjectBudgetLine from '#models/project_budget_line'
import ProjectContract from '#models/project_contract'
import {
  BUDGET_LINE_CODES,
  type BudgetLineCode,
} from '#constants/module56'
import { assertBudgetAmounts } from '#services/module56_rules'
import {
  approvedAmount,
  assertPerm,
  budgetSnapshot,
  hasPerm,
  isCnnv,
  loadOutline,
  money,
} from '#services/module56_common'

/**
 * Phân bổ 10 mục chi BM.06 khi hợp đồng còn dự thảo (QD-04).
 */
export default class ProjectBudgetService {
  static async snapshotFor(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    if (
      !(await isCnnv(userId, outline)) &&
      !(await hasPerm(userId, 'project.contract_manage')) &&
      !(await hasPerm(userId, 'project.view')) &&
      !(await hasPerm(userId, 'project.budget_confirm'))
    ) {
      throw new Error('FORBIDDEN')
    }
    return budgetSnapshot(outlineId)
  }

  static async replaceLines(
    contractId: number,
    actorId: number,
    rawLines: { code: string; amount: number }[]
  ) {
    await assertPerm(actorId, 'project.contract_manage')
    const contract = await ProjectContract.find(contractId)
    if (!contract) throw new Error('CONTRACT_NOT_FOUND')
    if (contract.status !== 'HOP_DONG_DRAFT') throw new Error('CONTRACT_NOT_DRAFT')

    const outline = await loadOutline(contract.projectOutlineId)
    const target = approvedAmount(outline)
    const map = new Map<string, number>()
    for (const row of rawLines || []) {
      const code = String(row.code || '').trim()
      if (!BUDGET_LINE_CODES.includes(code as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
      if (map.has(code)) throw new Error('INVALID_BUDGET_CODE')
      map.set(code, money(row.amount))
    }
    assertBudgetAmounts(map, target)

    await db.transaction(async (trx) => {
      await ProjectBudgetLine.query({ client: trx })
        .where('project_outline_id', outline.id)
        .delete()
      await ProjectBudgetLine.createMany(
        BUDGET_LINE_CODES.map((code) => ({
          projectOutlineId: outline.id,
          code,
          amount: map.get(code) || 0,
        })),
        { client: trx }
      )
    })

    return budgetSnapshot(outline.id)
  }
}
