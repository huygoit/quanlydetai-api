import { test } from '@japa/runner'
import DashboardOverviewService from '#services/dashboard_overview_service'

test.group('DashboardOverviewService', () => {
  test('buildRecentYears returns expected sequence', ({ assert }) => {
    const years = DashboardOverviewService.buildRecentYears(2026, 5)
    assert.deepEqual(years, [2022, 2023, 2024, 2025, 2026])
  })

  test('mergeUnitStats combines project and startup rows', ({ assert }) => {
    const result = DashboardOverviewService.mergeUnitStats(
      [
        { unit: 'Khoa CNTT', research_project: 5, student_research: 4 },
        { unit: 'Khoa Kinh tế', research_project: 2, student_research: 1 },
      ],
      [
        { unit: 'Khoa CNTT', startup: 3 },
        { unit: 'Khoa Sư phạm', startup: 2 },
      ]
    )

    const cntt = result.find((r) => r.unit === 'Khoa CNTT')
    assert.exists(cntt)
    assert.equal(cntt!.researchProject, 5)
    assert.equal(cntt!.studentResearch, 4)
    assert.equal(cntt!.startup, 3)
    assert.equal(cntt!.total, 12)
  })

  test('buildAlerts creates drop alert when trend decreases', ({ assert }) => {
    const alerts = DashboardOverviewService.buildAlerts(
      [
        { year: 2025, researchProject: 10, studentResearch: 8, startup: 6 },
        { year: 2026, researchProject: 8, studentResearch: 6, startup: 5 },
      ],
      [{ unit: 'Khoa A', researchProject: 1, studentResearch: 0, startup: 0, total: 1 }],
      [{ field: 'AI', researchProject: 1, studentResearch: 0, startup: 0, total: 1 }]
    )
    assert.isAtLeast(alerts.length, 1)
    assert.isTrue(alerts.some((a) => a.key === 'trend_drop'))
  })
})

