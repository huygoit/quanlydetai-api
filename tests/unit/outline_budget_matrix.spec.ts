import { test } from '@japa/runner'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import {
  calcQuanLyFromEditable,
  flattenBudgetMatrixToLines,
  normalizeBudgetMatrix,
} from '#constants/outline_budget_matrix'

test.group('Outline budget matrix', (group) => {
  group.tap((t) => t.timeout(30_000))

  test('quanLy = 5% tong (editable/0.95)', ({ assert }) => {
    // editable 950_000 ⇒ tong 1_000_000, quanLy 50_000
    assert.equal(calcQuanLyFromEditable(950_000), 50_000)
  })

  test('flatten tạo dòng từ ma trận', ({ assert }) => {
    const m = normalizeBudgetMatrix({
      STATE_LUMP: { THU_LAO: 1000000, VAT_LIEU: 500000 },
      STATE_NON_LUMP: {},
      NON_STATE: { CONG_BO: 200000 },
    })
    const lines = flattenBudgetMatrixToLines(m)
    assert.isTrue(lines.some((l) => l.content.includes('Thù lao')))
    assert.isTrue(lines.some((l) => l.note === 'Tự tính 5% tổng'))
    assert.isTrue(lines.reduce((s, l) => s + l.amount, 0) > 1_700_000)
  })

  test('applyDraftFields + sync budget_lines', async ({ assert }) => {
    const o = await ProjectOutline.query().orderBy('id', 'desc').first()
    if (!o) {
      assert.isTrue(true)
      return
    }
    const matrix = normalizeBudgetMatrix({
      STATE_LUMP: { THU_LAO: 2_000_000, CHI_KHAC: 100_000 },
      STATE_NON_LUMP: { DIEU_TRA: 300_000 },
      NON_STATE: { PHO_BIEN: 150_000 },
    })
    ProjectOutlineService.applyDraftFields(o, { budgetMatrix: matrix })
    await o.save()
    const lines = flattenBudgetMatrixToLines(o.budgetMatrix!)
    await ProjectOutlineService.replaceBudgetLines(o.id, lines)
    const saved = await ProjectOutlineBudgetLine.query().where('project_outline_id', o.id)
    const fresh = await ProjectOutline.findOrFail(o.id)
    assert.isOk(fresh.budgetMatrix?.STATE_LUMP)
    assert.equal(Number(fresh.budgetMatrix!.STATE_LUMP.THU_LAO), 2_000_000)
    assert.isTrue(saved.length >= 4)
  })
})
