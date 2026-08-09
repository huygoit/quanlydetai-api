import { test } from '@japa/runner'
import ProjectOutlineBudgetService, {
  BUDGET_DEVIATION_WARN_PERCENT,
  LARGE_BUDGET_THRESHOLD,
} from '#services/project_outline_budget_service'

test.group('ProjectOutlineBudgetService — pure rules', () => {
  test('calcDeviationRate: requested=0 → null', ({ assert }) => {
    assert.isNull(ProjectOutlineBudgetService.calcDeviationRate(100, 0))
  })

  test('calcDeviationRate: tính đúng %', ({ assert }) => {
    // |120-100|/100*100 = 20
    assert.equal(ProjectOutlineBudgetService.calcDeviationRate(120, 100), 20)
    assert.equal(ProjectOutlineBudgetService.calcDeviationRate(80, 100), 20)
  })

  test('needsDeviationWarning: > 20%', ({ assert }) => {
    assert.isFalse(ProjectOutlineBudgetService.needsDeviationWarning(120, 100)) // =20 không cảnh báo
    assert.isTrue(ProjectOutlineBudgetService.needsDeviationWarning(121, 100))
    assert.equal(BUDGET_DEVIATION_WARN_PERCENT, 20)
  })

  test('needsDeviationWarning: requested=0 và proposed>0 → cảnh báo ngoại lệ', ({ assert }) => {
    assert.isTrue(ProjectOutlineBudgetService.needsDeviationWarning(50, 0))
    assert.isFalse(ProjectOutlineBudgetService.needsDeviationWarning(0, 0))
  })

  test('requiresLargeBudgetCouncil theo ngưỡng', ({ assert }) => {
    assert.isFalse(
      ProjectOutlineBudgetService.requiresLargeBudgetCouncil(LARGE_BUDGET_THRESHOLD - 1)
    )
    assert.isTrue(
      ProjectOutlineBudgetService.requiresLargeBudgetCouncil(LARGE_BUDGET_THRESHOLD)
    )
  })

  test('validatePositiveBudget: chặn âm và 0 (mặc định)', ({ assert }) => {
    assert.isNotNull(ProjectOutlineBudgetService.validatePositiveBudget(-1))
    assert.isNotNull(ProjectOutlineBudgetService.validatePositiveBudget(0, false))
    assert.isNull(ProjectOutlineBudgetService.validatePositiveBudget(0, true))
    assert.isNull(ProjectOutlineBudgetService.validatePositiveBudget(1))
  })
})
