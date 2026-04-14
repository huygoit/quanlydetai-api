import { test } from '@japa/runner'
import KpiEngineService from '#services/kpi_engine_service'
import ResearchOutputRule from '#models/research_output_rule'
import type { KpiOutput } from '#types/kpi'

type RuleStub = {
  typeId: number
  ruleKind: string
  hoursValue: number | null
  pointsValue: number | null
  hoursBonus: number | null
}

function mockRules(ruleMap: Record<number, RuleStub>) {
  const originalQuery = (ResearchOutputRule as any).query
  ;(ResearchOutputRule as any).query = () => {
    let typeId: number | null = null
    return {
      where(column: string, value: number) {
        if (column === 'type_id') typeId = Number(value)
        return this
      },
      async firstOrFail() {
        const found = typeId != null ? ruleMap[typeId] : null
        if (!found) throw new Error('not found')
        return found
      },
    }
  }
  return () => {
    ;(ResearchOutputRule as any).query = originalQuery
  }
}

function pubOutput(params: {
  typeId: number | null
  hdgsnnScore?: number | null
  authors: Array<{
    isMainAuthor: boolean
    isCorresponding: boolean
    affiliationType: 'UDN_ONLY' | 'MIXED' | 'OUTSIDE'
    isMultiAffiliationOutsideUdn?: boolean
  }>
}): KpiOutput {
  return {
    type: 'PUBLICATION',
    publication: {
      id: 1,
      ownerProfileId: 100,
      researchOutputTypeId: params.typeId,
      hdgsnnScore: params.hdgsnnScore ?? null,
    },
    authors: params.authors.map((a, idx) => ({
      profileId: idx === 0 ? 100 : idx + 1000,
      fullName: `Tac gia ${idx + 1}`,
      isMainAuthor: a.isMainAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn ?? false,
    })),
  }
}

function projectOutput(params: {
  typeId: number | null
  acceptanceGrade?: string | null
  cFactor?: number | null
}): KpiOutput {
  return {
    type: 'PROJECT',
    project: {
      id: 10,
      researchOutputTypeId: params.typeId,
      level: 'CAP_TRUONG',
      acceptanceGrade: params.acceptanceGrade ?? null,
      cFactor: params.cFactor ?? null,
    },
  }
}

test.group('KPI Engine integration quy doi gio', () => {
  test('Cong bo MULTIPLY_A theo QD: 2 tac gia chinh, a=2, gio=1800, diem=3', async ({ assert }) => {
    const restore = mockRules({
      101: { typeId: 101, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 101,
          authors: [
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 1800)
      assert.equal(result.points, 3)
    } finally {
      restore()
    }
  })

  test('Cong bo dong tac gia tinh diem theo gio/600', async ({ assert }) => {
    const restore = mockRules({
      102: { typeId: 102, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 102,
          authors: [
            { isMainAuthor: false, isCorresponding: false, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: false, isCorresponding: false, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 800)
      assert.equal(result.points, 1.33)
    } finally {
      restore()
    }
  })

  test('Cong bo nu duoc nhan 1.2 sau khi tinh gio', async ({ assert }) => {
    const restore = mockRules({
      103: { typeId: 103, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 103,
          authors: [
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: true, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 2160)
      assert.equal(result.points, 3.6)
    } finally {
      restore()
    }
  })

  test('Cong bo MIXED co kiem nhiem ngoai se chia 2 gio', async ({ assert }) => {
    const restore = mockRules({
      104: { typeId: 104, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 104,
          authors: [
            {
              isMainAuthor: true,
              isCorresponding: true,
              affiliationType: 'MIXED',
              isMultiAffiliationOutsideUdn: true,
            },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 675)
      assert.equal(result.points, 1.13)
    } finally {
      restore()
    }
  })

  test('Cong bo OUTSIDE thi gio va diem bang 0 theo muc 1.5', async ({ assert }) => {
    const restore = mockRules({
      105: { typeId: 105, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 105,
          authors: [
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'OUTSIDE' },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 0)
      assert.equal(result.points, 0)
    } finally {
      restore()
    }
  })

  test('Cong bo HDGSNN: diem quy doi tinh theo gio/600', async ({ assert }) => {
    const restore = mockRules({
      106: {
        typeId: 106,
        ruleKind: 'HDGSNN_POINTS_TO_HOURS',
        hoursValue: 600,
        pointsValue: null,
        hoursBonus: null,
      },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 106,
          hdgsnnScore: 1.5,
          authors: [
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: true, isCorresponding: true, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 450)
      assert.equal(result.points, 0.75)
    } finally {
      restore()
    }
  })

  test('Cong bo n=0 va >1 tac gia thi dung an toan, gio=0 diem=0', async ({ assert }) => {
    const restore = mockRules({
      107: { typeId: 107, ruleKind: 'MULTIPLY_A', hoursValue: 1800, pointsValue: 3, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        pubOutput({
          typeId: 107,
          authors: [
            { isMainAuthor: false, isCorresponding: false, affiliationType: 'UDN_ONLY' },
            { isMainAuthor: false, isCorresponding: false, affiliationType: 'UDN_ONLY' },
          ],
        }),
        { profileId: 100, academicYear: '2025-2026', isFemale: false, profileFullName: 'Tac gia 1' }
      )
      assert.equal(result.hours, 0)
      assert.equal(result.points, 0)
      assert.isTrue(result.warnings.some((w) => w.includes('n≥1')))
    } finally {
      restore()
    }
  })

  test('De tai MULTIPLY_C dung c_factor uu tien hon acceptance_grade', async ({ assert }) => {
    const restore = mockRules({
      201: { typeId: 201, ruleKind: 'MULTIPLY_C', hoursValue: 1000, pointsValue: 2, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        projectOutput({ typeId: 201, cFactor: 1.25, acceptanceGrade: 'PASS_LATE' }),
        { profileId: 100, academicYear: '2025-2026' }
      )
      assert.equal(result.hours, 1250)
      assert.equal(result.points, 2.08)
    } finally {
      restore()
    }
  })

  test('De tai MULTIPLY_C map acceptance_grade EXCELLENT => c=1.1', async ({ assert }) => {
    const restore = mockRules({
      202: { typeId: 202, ruleKind: 'MULTIPLY_C', hoursValue: 1000, pointsValue: 2, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        projectOutput({ typeId: 202, acceptanceGrade: 'EXCELLENT' }),
        { profileId: 100, academicYear: '2025-2026' }
      )
      assert.equal(result.hours, 1100)
      assert.equal(result.points, 1.83)
    } finally {
      restore()
    }
  })

  test('De tai FIXED tinh diem = gio/600', async ({ assert }) => {
    const restore = mockRules({
      203: { typeId: 203, ruleKind: 'FIXED', hoursValue: 800, pointsValue: 0, hoursBonus: null },
    })
    try {
      const result = await KpiEngineService.calculateOutputHours(
        projectOutput({ typeId: 203 }),
        { profileId: 100, academicYear: '2025-2026' }
      )
      assert.equal(result.hours, 800)
      assert.equal(result.points, 1.33)
    } finally {
      restore()
    }
  })

  test('Loai don gian chua ho tro tra ve 0 va canh bao', async ({ assert }) => {
    const result = await KpiEngineService.calculateOutputHours(
      { type: 'BOOK', payload: {} },
      { profileId: 100, academicYear: '2025-2026' }
    )
    assert.equal(result.hours, 0)
    assert.equal(result.points, 0)
    assert.isTrue(result.warnings.some((w) => w.includes('nguồn dữ liệu')))
  })
})
