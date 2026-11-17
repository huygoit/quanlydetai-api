import { test } from '@japa/runner'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineService from '#services/project_outline_service'

test.group('Outline expectedResults — lưu JSON', (group) => {
  group.tap((t) => t.timeout(30_000))

  test('applyDraftFields + save + reload giữ expected_results', async ({ assert }) => {
    const o = await ProjectOutline.query().orderBy('id', 'desc').first()
    if (!o) {
      assert.isTrue(true, 'skip — không có outline')
      return
    }

    const payload = {
      expectedResults: {
        publications: [
          {
            id: 'pub-test-1',
            category: 'DOMESTIC',
            content: 'Bai bao trong nuoc test',
            quantity: '1',
            scienceRequirement: 'Tap chi uy tin',
            note: 'ok',
          },
          {
            id: 'pub-test-2',
            category: 'INTERNATIONAL',
            content: 'Bai bao quoc te test',
            quantity: '1',
            scienceRequirement: 'Scopus Q1',
            note: null,
          },
        ],
        appliedProducts: [
          {
            id: 'app-test-1',
            name: 'Quy trinh ung dung',
            scienceRequirement: 'Ap dung duoc',
            note: null,
          },
        ],
        tangibleProducts: [
          {
            id: 'tan-test-1',
            name: 'Mau thiet bi A',
            unit: 'bo',
            qualityRequired: 'Dat TCVN',
            qualitySampleDomestic: 'Mau X',
            qualitySampleWorld: 'Mau Y',
            quantityScale: '2',
          },
        ],
        ipProducts: [
          {
            id: 'ip-test-1',
            name: 'Sang che Z',
            scienceRequirement: 'Nop don',
            note: null,
          },
        ],
        postgraduateTraining: [
          {
            id: 'trn-test-1',
            level: 'Thac si',
            quantity: '1',
            major: 'CNTT',
            note: null,
          },
        ],
      },
    }

    ProjectOutlineService.applyDraftFields(o, payload)
    await o.save()

    const fresh = await ProjectOutline.findOrFail(o.id)
    const er = fresh.expectedResults
    assert.isOk(er)
    assert.equal(er!.publications.length, 2)
    assert.equal(er!.publications[0].content, 'Bai bao trong nuoc test')
    assert.equal(er!.publications[1].category, 'INTERNATIONAL')
    assert.equal(er!.appliedProducts[0].name, 'Quy trinh ung dung')
    assert.equal(er!.tangibleProducts[0].unit, 'bo')
    assert.equal(er!.ipProducts[0].name, 'Sang che Z')
    assert.equal(er!.postgraduateTraining[0].level, 'Thac si')
    // Đồng bộ expected_products cũ
    assert.isTrue((fresh.expectedProducts || []).some((p) => p.name.includes('Quy trinh')))
  })
})
