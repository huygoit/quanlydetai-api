import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ProjectOutlineRevisionService, {
  MIN_REVISION_EXPLANATION,
  REVISION_REMINDER_DAYS,
  type OutlineSnapshot,
} from '#services/project_outline_revision_service'

function snap(partial: Partial<OutlineSnapshot> = {}): OutlineSnapshot {
  return {
    title: 'Đề tài A',
    field: 'CNTT',
    hostUnit: 'Khoa A',
    requestedBudget: 100000000,
    applicationScope: 'Trong nước',
    urgency: 'Cấp thiết',
    detailedObjectives: 'Mục tiêu 1',
    researchContent: 'Nội dung',
    methodology: 'PP',
    summary: 'Tóm tắt',
    milestones: [{ content: 'Mốc 1' }],
    expectedProducts: [{ name: 'SP1' }],
    partnerUnits: [],
    outlineFileUrl: '/files/a.pdf',
    appendixFileUrl: null,
    members: [{ fullName: 'Nguyen A', role: 'PRINCIPAL', contributionPercent: 100 }],
    budgetLines: [{ groupCode: 'NHAN_CONG', content: 'Công', amount: 100000000, note: null }],
    ...partial,
  }
}

test.group('ProjectOutlineRevisionService — pure rules', () => {
  test('isPastDeadline: null = chưa hết hạn', ({ assert }) => {
    assert.isFalse(ProjectOutlineRevisionService.isPastDeadline(null))
  })

  test('isPastDeadline: quá hạn khi deadline < now', ({ assert }) => {
    const now = DateTime.fromISO('2026-08-10T10:00:00')
    const past = DateTime.fromISO('2026-08-09T23:59:59')
    const future = DateTime.fromISO('2026-08-11T00:00:00')
    assert.isTrue(ProjectOutlineRevisionService.isPastDeadline(past, now))
    assert.isFalse(ProjectOutlineRevisionService.isPastDeadline(future, now))
  })

  test('needsReminder: trong cửa sổ N ngày trước hạn', ({ assert }) => {
    const now = DateTime.fromISO('2026-08-10T10:00:00')
    const inOneDay = now.plus({ days: 1 })
    const inFiveDays = now.plus({ days: 5 })
    const yesterday = now.minus({ days: 1 })
    assert.isTrue(
      ProjectOutlineRevisionService.needsReminder(inOneDay, REVISION_REMINDER_DAYS, now)
    )
    assert.isFalse(
      ProjectOutlineRevisionService.needsReminder(inFiveDays, REVISION_REMINDER_DAYS, now)
    )
    assert.isFalse(
      ProjectOutlineRevisionService.needsReminder(yesterday, REVISION_REMINDER_DAYS, now)
    )
  })

  test('validateExplanation: bắt buộc ≥ 100 ký tự', ({ assert }) => {
    assert.isNotNull(ProjectOutlineRevisionService.validateExplanation('ngắn'))
    assert.isNotNull(ProjectOutlineRevisionService.validateExplanation(' '.repeat(100)))
    assert.isNull(
      ProjectOutlineRevisionService.validateExplanation('x'.repeat(MIN_REVISION_EXPLANATION))
    )
    const err = ProjectOutlineRevisionService.validateExplanation('abc')
    assert.include(err || '', String(MIN_REVISION_EXPLANATION))
  })

  test('diffSnapshots: phát hiện field đổi và bỏ field giống', ({ assert }) => {
    const before = snap()
    const after = snap({
      title: 'Đề tài B',
      requestedBudget: 120000000,
      outlineFileUrl: '/files/b.pdf',
      methodology: 'PP mới',
    })
    const diffs = ProjectOutlineRevisionService.diffSnapshots(before, after)
    const fields = diffs.map((d) => d.field)
    assert.includeMembers(fields, ['title', 'requestedBudget', 'outlineFileUrl', 'methodology'])
    assert.notInclude(fields, 'hostUnit')
    const fileDiff = diffs.find((d) => d.field === 'outlineFileUrl')
    assert.equal(fileDiff?.kind, 'file')
    const budgetDiff = diffs.find((d) => d.field === 'requestedBudget')
    assert.equal(budgetDiff?.kind, 'number')
  })

  test('diffSnapshots: members/budget json đổi', ({ assert }) => {
    const before = snap()
    const after = snap({
      members: [
        { fullName: 'Nguyen A', role: 'PRINCIPAL', contributionPercent: 70 },
        { fullName: 'Tran B', role: 'MEMBER', contributionPercent: 30 },
      ],
    })
    const diffs = ProjectOutlineRevisionService.diffSnapshots(before, after)
    assert.isTrue(diffs.some((d) => d.field === 'members' && d.kind === 'json'))
  })

  test('normalizeForCompare: null và string trống tương đương', ({ assert }) => {
    assert.equal(ProjectOutlineRevisionService.normalizeForCompare(null), '')
    assert.equal(ProjectOutlineRevisionService.normalizeForCompare('  a  '), 'a')
  })
})
