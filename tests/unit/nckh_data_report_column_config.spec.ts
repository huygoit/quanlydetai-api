import { test } from '@japa/runner'
import NckhDataReportColumnConfigService from '#services/nckh_data_report_column_config_service'

/** Fixture cây nhỏ: 2 nhóm L1 → vài L2 → vài L3 */
function fixtureTypes() {
  return [
    { id: 1, code: 'L1A', name: 'Nhom A', level: 1, parentId: null, isActive: true, sortOrder: 1 },
    { id: 2, code: 'L1B', name: 'Nhom B', level: 1, parentId: null, isActive: true, sortOrder: 2 },
    { id: 10, code: 'L2A1', name: 'Muc 1', level: 2, parentId: 1, isActive: true, sortOrder: 1 },
    { id: 11, code: 'L2A2', name: 'Muc 2', level: 2, parentId: 1, isActive: true, sortOrder: 2 },
    { id: 20, code: 'L2B1', name: 'Muc 8', level: 2, parentId: 2, isActive: true, sortOrder: 1 },
    { id: 100, code: 'R1', name: '1.1', level: 3, parentId: 10, isActive: true, sortOrder: 1 },
    { id: 101, code: 'R2', name: '1.2', level: 3, parentId: 10, isActive: true, sortOrder: 2 },
    { id: 110, code: 'R3', name: '2.1', level: 3, parentId: 11, isActive: true, sortOrder: 1 },
    { id: 200, code: 'R8', name: '8.1', level: 3, parentId: 20, isActive: true, sortOrder: 1 },
    {
      id: 201,
      code: 'R8X',
      name: '8.x inactive',
      level: 3,
      parentId: 20,
      isActive: false,
      sortOrder: 2,
    },
  ]
}

test.group('NckhDataReportColumnConfig — parseValue', () => {
  test('null / rỗng → null', ({ assert }) => {
    assert.isNull(NckhDataReportColumnConfigService.parseValue(null))
    assert.isNull(NckhDataReportColumnConfigService.parseValue(''))
    assert.isNull(NckhDataReportColumnConfigService.parseValue('   '))
  })

  test('JSON hợp lệ → selection đã chuẩn hóa id', ({ assert }) => {
    const s = NckhDataReportColumnConfigService.parseValue(
      JSON.stringify({
        level1Ids: [1, '2', 1, 0, -3],
        level2Ids: [10],
        level3Ids: [100, 101],
      })
    )
    assert.deepEqual(s, {
      level1Ids: [1, 2],
      level2Ids: [10],
      level3Ids: [100, 101],
    })
  })

  test('JSON hỏng → null', ({ assert }) => {
    assert.isNull(NckhDataReportColumnConfigService.parseValue('{bad'))
  })
})

test.group('NckhDataReportColumnConfig — buildDisplayColumns', () => {
  test('không chọn L3 → không có cột', ({ assert }) => {
    const { columnTree, leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(
      fixtureTypes(),
      { level1Ids: [1], level2Ids: [10], level3Ids: [] }
    )
    assert.lengthOf(columnTree, 0)
    assert.lengthOf(leafColumns, 0)
  })

  test('chọn 1 L3 → 1 cột lá + header L1/L2 đúng', ({ assert }) => {
    const { columnTree, leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(
      fixtureTypes(),
      { level1Ids: [1], level2Ids: [10], level3Ids: [100] }
    )
    assert.lengthOf(leafColumns, 1)
    assert.equal(leafColumns[0].id, 100)
    assert.equal(leafColumns[0].level1Id, 1)
    assert.equal(leafColumns[0].level2Id, 10)
    assert.lengthOf(columnTree, 1)
    assert.equal(columnTree[0].id, 1)
    assert.lengthOf(columnTree[0].children, 1)
    assert.equal(columnTree[0].children[0].id, 10)
    assert.lengthOf(columnTree[0].children[0].children, 1)
    assert.equal(columnTree[0].children[0].children[0].id, 100)
  })

  test('chọn L3 nhưng thiếu L2 trong selection → không hiện (cần tổ tiên)', ({ assert }) => {
    const { leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(fixtureTypes(), {
      level1Ids: [1],
      level2Ids: [],
      level3Ids: [100],
    })
    assert.lengthOf(leafColumns, 0)
  })

  test('chọn nhiều L3 thuộc 2 nhóm L1 → thứ tự sort + đủ lá', ({ assert }) => {
    const { columnTree, leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(
      fixtureTypes(),
      {
        level1Ids: [1, 2],
        level2Ids: [10, 11, 20],
        level3Ids: [101, 100, 200, 110],
      }
    )
    assert.deepEqual(
      leafColumns.map((c) => c.id),
      [100, 101, 110, 200]
    )
    assert.lengthOf(columnTree, 2)
    assert.equal(columnTree[0].name, 'Nhom A')
    assert.equal(columnTree[1].name, 'Nhom B')
  })

  test('bỏ qua node isActive=false dù nằm trong selection', ({ assert }) => {
    const { leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(fixtureTypes(), {
      level1Ids: [2],
      level2Ids: [20],
      level3Ids: [200, 201],
    })
    assert.deepEqual(
      leafColumns.map((c) => c.id),
      [200]
    )
  })

  test('chỉ chọn L1/L2 không có L3 → không cột', ({ assert }) => {
    const { columnTree, leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(
      fixtureTypes(),
      { level1Ids: [1, 2], level2Ids: [10, 20], level3Ids: [] }
    )
    assert.lengthOf(columnTree, 0)
    assert.lengthOf(leafColumns, 0)
  })
})
