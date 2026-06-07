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

  test('aggregatePublicationsByRootType rolls leaf counts up to root type', ({ assert }) => {
    const typeById = new Map([
      [1, { id: 1, parentId: null, code: 'I', name: 'Công bố khoa học' }],
      [2, { id: 2, parentId: 1, code: 'I.1', name: 'Bài báo tạp chí' }],
      [3, { id: 3, parentId: 2, code: 'PUB_WOS_Q1', name: 'Bài báo WOS Q1' }],
      [4, { id: 4, parentId: null, code: 'II', name: 'Sách, giáo trình' }],
    ])

    const result = DashboardOverviewService.aggregatePublicationsByRootType(
      [
        { research_output_type_id: 3, total: 5 },
        { research_output_type_id: 4, total: 2 },
        { research_output_type_id: null, total: 1 },
      ],
      typeById,
      [
        { id: 1, parentId: null, code: 'I', name: 'Công bố khoa học', sortOrder: 1 },
        { id: 4, parentId: null, code: 'II', name: 'Sách, giáo trình', sortOrder: 2 },
        { id: 5, parentId: null, code: 'III', name: 'Bằng độc quyền', sortOrder: 3 },
      ]
    )

    const pub = result.find((r) => r.code === 'I')
    const book = result.find((r) => r.code === 'II')
    const patent = result.find((r) => r.code === 'III')
    const unclassified = result.find((r) => r.code === 'UNCLASSIFIED')
    assert.exists(pub)
    assert.equal(pub!.count, 5)
    assert.exists(book)
    assert.equal(book!.count, 2)
    assert.exists(patent)
    assert.equal(patent!.count, 0)
    assert.exists(unclassified)
    assert.equal(unclassified!.count, 1)
    assert.equal(result.length, 4)
  })
})

