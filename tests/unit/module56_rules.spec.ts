import { test } from '@japa/runner'
import {
  assertBudgetAmounts,
  applyBm06Edits,
  canReopenFinalMinutes,
  hasCouncilQuorum,
  mergeBm06Edits,
} from '#services/module56_rules'
import { BUDGET_LINE_CODES } from '#constants/module56'

function du10(muc09 = 0) {
  const map = new Map<string, number>()
  BUDGET_LINE_CODES.forEach((code, index) => {
    map.set(code, code === 'MUC_09' ? muc09 : index === 0 ? 1000 - muc09 : 0)
  })
  return map
}

test.group('Module 5–6 — quy tắc thuần', () => {
  test('túc số hội đồng khi có mặt đạt hai phần ba', ({ assert }) => {
    assert.isTrue(hasCouncilQuorum(2, 3))
    assert.isFalse(hasCouncilQuorum(1, 3))
    assert.isFalse(hasCouncilQuorum(0, 0))
  })

  test('10 mục chi phải đủ, đúng tổng, mục 09 không quá 5%', ({ assert }) => {
    assert.doesNotThrow(() => assertBudgetAmounts(du10(50), 1000))
    assert.throws(() => assertBudgetAmounts(new Map([['MUC_01', 1000]]), 1000), 'BUDGET_LINES_INCOMPLETE')
    assert.throws(() => assertBudgetAmounts(du10(0), 999), 'BUDGET_SUM_MISMATCH')
    assert.throws(() => assertBudgetAmounts(du10(51), 1000), 'MUC_09_OVER_5_PERCENT')
  })

  test('sửa điều khoản giữ key được phép và bỏ key lấy từ thuyết minh', ({ assert }) => {
    const current = { ten_nhiem_vu: 'A', dia_diem_ky: 'Hà Nội' }
    const next = applyBm06Edits(current, { dia_diem_ky: 'TP.HCM', ten_nhiem_vu: 'B', key_la: 'x' })
    assert.equal(next.dia_diem_ky, 'TP.HCM')
    assert.equal(next.ten_nhiem_vu, 'A')
    assert.throws(() => applyBm06Edits(current, { ten_nhiem_vu: 'B' }), 'FIELDS_REQUIRED')
  })

  test('chỉ mở lại biên bản khi chưa có quyết toán hoặc giải trình đã nộp', ({ assert }) => {
    const base = {
      minutesLocked: true,
      executionStatus: 'DGCK_CHO_QUYET_TOAN',
      settlementStatus: 'QT_DRAFT',
      settlementLineCount: 0,
      settlementFileCount: 0,
      explanationStatus: null,
    }
    assert.isTrue(canReopenFinalMinutes(base))
    assert.isTrue(canReopenFinalMinutes({ ...base, executionStatus: 'DGCK_CHINH_SUA', settlementStatus: null }))
    assert.isTrue(canReopenFinalMinutes({ ...base, executionStatus: 'DGCK_KHONG_DAT', settlementStatus: null }))
    assert.isFalse(canReopenFinalMinutes({ ...base, minutesLocked: false }))
    assert.isFalse(canReopenFinalMinutes({ ...base, settlementStatus: 'QT_CHO_PKH' }))
    assert.isFalse(canReopenFinalMinutes({ ...base, settlementLineCount: 1 }))
    assert.isFalse(canReopenFinalMinutes({ ...base, explanationStatus: 'CHO_THU_KY', executionStatus: 'DGCK_CHINH_SUA' }))
    assert.isFalse(canReopenFinalMinutes({ ...base, executionStatus: 'DGCK_DINH_CHI', settlementStatus: null }))
  })

  test('sinh lại hợp đồng giữ điều khoản đã sửa', ({ assert }) => {
    const fresh = { ten_nhiem_vu: 'Mới', dia_diem_ky: '', so_hop_dong: 'HD-1' }
    const kept = mergeBm06Edits(fresh, { ten_nhiem_vu: 'Cũ', dia_diem_ky: 'Đà Nẵng', so_hop_dong: '' })
    assert.equal(kept.ten_nhiem_vu, 'Mới')
    assert.equal(kept.dia_diem_ky, 'Đà Nẵng')
    assert.equal(kept.so_hop_dong, 'HD-1')
  })
})
