/**
 * Test tích hợp Thống kê kết quả NCKH:
 * 1) Cấu trúc cột từ danh mục thật
 * 2) Đếm publications khớp leaf
 * 3) (Nếu API chạy) GET/PUT column-config + GET report
 *
 * Chạy: node scripts/test_nckh_data_report.mjs
 * Tuỳ chọn: API_BASE=http://127.0.0.1:3333 ADMIN_EMAIL=... ADMIN_PASSWORD=...
 */
import 'dotenv/config'
import pg from 'pg'

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3333').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@university.edu.vn'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

let passed = 0
let failed = 0
const failures = []

function ok(name) {
  passed++
  console.log(`  ✓ ${name}`)
}
function fail(name, detail) {
  failed++
  failures.push({ name, detail })
  console.log(`  ✗ ${name}`)
  console.log(`    → ${detail}`)
}
function assert(cond, name, detail = '') {
  if (cond) ok(name)
  else fail(name, detail || 'assertion false')
}

/** Logic build cột (mirror service) để kiểm tra độc lập với import TS. */
function buildDisplayColumns(allTypes, selection) {
  const l1Set = new Set(selection.level1Ids)
  const l2Set = new Set(selection.level2Ids)
  const l3Set = new Set(selection.level3Ids)
  const byParent = new Map()
  for (const t of allTypes) {
    if (!t.is_active) continue
    const p = t.parent_id
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(t)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  }
  const leafColumns = []
  const columnTree = []
  const roots = (byParent.get(null) || []).filter((t) => t.level === 1 && l1Set.has(t.id))
  for (const l1 of roots) {
    const l2Nodes = []
    const l2s = (byParent.get(l1.id) || []).filter((t) => t.level === 2 && l2Set.has(t.id))
    for (const l2 of l2s) {
      const l3s = (byParent.get(l2.id) || []).filter((t) => t.level === 3 && l3Set.has(t.id))
      if (!l3s.length) continue
      const children = l3s.map((l3) => {
        leafColumns.push({
          id: l3.id,
          name: l3.name,
          level1Id: l1.id,
          level2Id: l2.id,
        })
        return { id: l3.id, name: l3.name, level: 3, children: [] }
      })
      l2Nodes.push({ id: l2.id, name: l2.name, level: 2, children })
    }
    if (!l2Nodes.length) continue
    columnTree.push({ id: l1.id, name: l1.name, level: 1, children: l2Nodes })
  }
  return { columnTree, leafColumns }
}

async function apiJson(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function main() {
  console.log('\n=== TEST Thống kê kết quả NCKH ===\n')
  const c = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  })
  await c.connect()

  // --- A. Danh mục ---
  console.log('[A] Danh mục research_output_types')
  const typesRes = await c.query(`
    SELECT id, code, name, level, parent_id, is_active, sort_order
    FROM research_output_types
    ORDER BY sort_order, id
  `)
  const types = typesRes.rows.map((r) => ({
    ...r,
    id: Number(r.id),
    level: Number(r.level),
    parent_id: r.parent_id != null ? Number(r.parent_id) : null,
    sort_order: Number(r.sort_order ?? 0),
    is_active: !!r.is_active,
  }))
  const l1 = types.filter((t) => t.level === 1 && t.is_active)
  const l2 = types.filter((t) => t.level === 2 && t.is_active)
  const l3 = types.filter((t) => t.level === 3 && t.is_active)
  assert(l1.length === 5, `Có 5 nhóm L1 (got ${l1.length})`)
  assert(l2.length === 21, `Có 21 mục L2 (got ${l2.length})`)
  assert(l3.length >= 70, `Có đủ L3 active (got ${l3.length})`)

  // --- B. buildDisplayColumns ---
  console.log('\n[B] buildDisplayColumns trên catalog thật')
  const empty = buildDisplayColumns(types, { level1Ids: [], level2Ids: [], level3Ids: [] })
  assert(empty.leafColumns.length === 0, 'Selection rỗng → 0 cột lá')

  const sampleL3 = l3.slice(0, 3)
  const parentOf = (id) => types.find((t) => t.id === id)
  const needL2 = new Set()
  const needL1 = new Set()
  for (const leaf of sampleL3) {
    const p2 = parentOf(leaf.parent_id)
    if (!p2) continue
    needL2.add(p2.id)
    if (p2.parent_id) needL1.add(p2.parent_id)
  }
  const partial = buildDisplayColumns(types, {
    level1Ids: [...needL1],
    level2Ids: [...needL2],
    level3Ids: sampleL3.map((t) => t.id),
  })
  assert(
    partial.leafColumns.length === sampleL3.length,
    `Chọn ${sampleL3.length} L3 → đúng số cột (got ${partial.leafColumns.length})`
  )
  assert(
    partial.leafColumns.every((lc) => sampleL3.some((s) => s.id === lc.id)),
    'Mọi cột lá thuộc selection L3'
  )
  assert(partial.columnTree.length >= 1, 'Có ít nhất 1 header L1')

  const allSel = {
    level1Ids: l1.map((t) => t.id),
    level2Ids: l2.map((t) => t.id),
    level3Ids: l3.map((t) => t.id),
  }
  const allCols = buildDisplayColumns(types, allSel)
  assert(
    allCols.leafColumns.length === l3.length,
    `Chọn hết → ${l3.length} cột lá (got ${allCols.leafColumns.length})`
  )

  // --- C. Đếm data thật theo faculty ---
  console.log('\n[C] Đối chiếu đếm publications theo loại L3')
  const facRes = await c.query(`
    SELECT faculty, COUNT(*)::int AS n
    FROM scientific_profiles
    WHERE faculty IS NOT NULL AND TRIM(faculty) <> ''
    GROUP BY faculty
    ORDER BY n DESC
    LIMIT 5
  `)
  assert(facRes.rows.length > 0, 'Có ít nhất 1 khoa có hồ sơ')

  const faculty = facRes.rows[0].faculty
  console.log(`    Khoa test: "${faculty}" (${facRes.rows[0].n} hồ sơ)`)

  // Lấy 5 L3 có nhiều pub nhất trong khoa (hoặc bất kỳ L3 nếu không có)
  const topLeaves = await c.query(
    `
    SELECT p.research_output_type_id AS type_id, COUNT(*)::int AS cnt
    FROM publications p
    JOIN scientific_profiles sp ON sp.id = p.profile_id
    WHERE sp.faculty = $1
      AND p.research_output_type_id IS NOT NULL
    GROUP BY p.research_output_type_id
    ORDER BY cnt DESC
    LIMIT 5
  `,
    [faculty]
  )

  let testLeafIds = topLeaves.rows.map((r) => Number(r.type_id)).filter(Boolean)
  if (testLeafIds.length === 0) {
    testLeafIds = l3.slice(0, 5).map((t) => t.id)
    console.log('    (Khoa chưa có pub typed — dùng 5 L3 bất kỳ, kỳ vọng count=0)')
  }

  const l2ids = new Set()
  const l1ids = new Set()
  for (const id of testLeafIds) {
    const leaf = types.find((t) => t.id === id)
    if (!leaf) continue
    const p2 = parentOf(leaf.parent_id)
    if (!p2) continue
    l2ids.add(p2.id)
    if (p2.parent_id) l1ids.add(p2.parent_id)
  }
  const sel = {
    level1Ids: [...l1ids],
    level2Ids: [...l2ids],
    level3Ids: testLeafIds,
  }
  const built = buildDisplayColumns(types, sel)
  assert(
    built.leafColumns.length === testLeafIds.filter((id) => l3.some((t) => t.id === id)).length,
    'Cột lá sau filter active khớp selection'
  )

  // SQL expected counts (không lọc ngày = all)
  const expected = await c.query(
    `
    SELECT p.research_output_type_id AS type_id, COUNT(*)::int AS cnt
    FROM publications p
    JOIN scientific_profiles sp ON sp.id = p.profile_id
    WHERE sp.faculty = $1
      AND p.research_output_type_id = ANY($2::bigint[])
    GROUP BY p.research_output_type_id
  `,
    [faculty, testLeafIds]
  )
  const expectedMap = new Map(expected.rows.map((r) => [Number(r.type_id), Number(r.cnt)]))

  // Mô phỏng đếm như controller (all profiles in faculty)
  const profiles = await c.query(
    `SELECT id, full_name FROM scientific_profiles WHERE faculty = $1`,
    [faculty]
  )
  const profileIds = profiles.rows.map((r) => Number(r.id))
  const leafSet = new Set(built.leafColumns.map((c) => c.id))
  const countsByProfile = new Map()
  for (const pid of profileIds) {
    const counts = {}
    for (const leaf of built.leafColumns) counts[String(leaf.id)] = 0
    countsByProfile.set(pid, counts)
  }
  if (profileIds.length) {
    const pubs = await c.query(
      `
      SELECT profile_id, research_output_type_id
      FROM publications
      WHERE profile_id = ANY($1::bigint[])
        AND research_output_type_id IS NOT NULL
    `,
      [profileIds]
    )
    for (const pub of pubs.rows) {
      const pid = Number(pub.profile_id)
      const tid = Number(pub.research_output_type_id)
      if (!leafSet.has(tid)) continue
      const row = countsByProfile.get(pid)
      if (!row) continue
      row[String(tid)] = (row[String(tid)] || 0) + 1
    }
  }
  const totals = {}
  for (const leaf of built.leafColumns) totals[String(leaf.id)] = 0
  for (const counts of countsByProfile.values()) {
    for (const leaf of built.leafColumns) {
      const k = String(leaf.id)
      totals[k] += counts[k] || 0
    }
  }

  let countMatch = true
  for (const leaf of built.leafColumns) {
    const got = totals[String(leaf.id)] || 0
    const exp = expectedMap.get(leaf.id) || 0
    if (got !== exp) {
      countMatch = false
      fail(
        `Đếm type ${leaf.id}`,
        `expected ${exp}, got ${got}`
      )
    }
  }
  if (countMatch) ok(`Tổng đếm theo L3 khớp SQL (${built.leafColumns.length} cột)`)

  // Cột không chọn không được cộng
  const otherL3 = l3.find((t) => !testLeafIds.includes(t.id))
  if (otherL3) {
    assert(
      !built.leafColumns.some((c) => c.id === otherL3.id),
      `L3 ${otherL3.id} không chọn → không có trong leafColumns`
    )
  }

  // --- D. system_configs key tồn tại ---
  console.log('\n[D] system_configs')
  const cfg = await c.query(
    `SELECT key, value FROM system_configs WHERE key = 'nckh_data_report_columns'`
  )
  assert(cfg.rows.length === 1, 'Có khóa nckh_data_report_columns')

  // Backup config để restore
  const oldValue = cfg.rows[0]?.value ?? null

  // --- E. HTTP API (nếu server sống) ---
  console.log('\n[E] HTTP API')
  let apiUp = false
  try {
    const health = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) })
    apiUp = health.ok || health.status < 500
  } catch {
    apiUp = false
  }

  if (!apiUp) {
    fail('API đang chạy', `Không kết nối ${API_BASE} — bỏ qua HTTP (start: npm run dev)`)
  } else {
    ok(`API reachable ${API_BASE}`)
    const login = await apiJson('/api/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    const token =
      login.json?.data?.token?.token ||
      login.json?.data?.token ||
      login.json?.data?.accessToken ||
      login.json?.token ||
      login.json?.accessToken
    if (!token || typeof token === 'object') {
      fail('Login admin', JSON.stringify(login.json)?.slice(0, 300))
    } else {
      ok('Login admin thành công')

      // Lưu selection hẹp
      const putRes = await apiJson('/api/kpis/nckh-data-report/column-config', {
        method: 'PUT',
        token,
        body: sel,
      })
      assert(putRes.status === 200 && putRes.json?.success, 'PUT column-config 200')

      const getCfg = await apiJson('/api/kpis/nckh-data-report/column-config', { token })
      assert(getCfg.json?.success, 'GET column-config success')
      const savedL3 = getCfg.json?.data?.selection?.level3Ids || []
      assert(
        testLeafIds.every((id) => savedL3.map(Number).includes(id)),
        'GET config chứa đủ L3 đã lưu'
      )

      const reportRes = await apiJson(
        `/api/kpis/nckh-data-report?all=1&faculty=${encodeURIComponent(faculty)}`,
        { token }
      )
      assert(reportRes.status === 200 && reportRes.json?.success, 'GET nckh-data-report 200')
      const data = reportRes.json?.data
      const apiLeaves = data?.leafColumns || []
      assert(
        apiLeaves.length === built.leafColumns.length,
        `Report leafColumns = ${built.leafColumns.length} (got ${apiLeaves.length})`
      )

      // Header 3 tầng: mọi leaf thuộc columnTree
      const leafIdsFromTree = []
      for (const n1 of data?.columnTree || []) {
        for (const n2 of n1.children || []) {
          for (const n3 of n2.children || []) leafIdsFromTree.push(n3.id)
        }
      }
      assert(
        leafIdsFromTree.length === apiLeaves.length,
        'columnTree L3 khớp leafColumns'
      )

      // Totals khớp SQL expected
      let apiCountOk = true
      for (const leaf of apiLeaves) {
        const got = Number(data.totals?.counts?.[String(leaf.id)] || 0)
        const exp = expectedMap.get(Number(leaf.id)) || 0
        if (got !== exp) {
          apiCountOk = false
          fail(`API totals type ${leaf.id}`, `expected ${exp}, got ${got}`)
        }
      }
      if (apiCountOk) ok('API totals.counts khớp SQL')

      // Mỗi row.counts chỉ có key của leaf đã chọn
      const row = (data.rows || [])[0]
      if (row) {
        const keys = Object.keys(row.counts || {}).map(Number)
        assert(
          keys.every((id) => apiLeaves.some((l) => l.id === id)),
          'row.counts chỉ chứa cột đã chọn'
        )
        assert(typeof row.hours === 'number', 'row có hours')
        assert(row.hoTenDem != null && row.ten != null, 'row có hoTenDem/ten')
      } else {
        ok('Khoa không có hồ sơ / không có dòng (bỏ qua check row)')
      }

      // Restore config cũ
      if (oldValue == null) {
        await c.query(
          `UPDATE system_configs SET value = NULL, updated_at = NOW() WHERE key = 'nckh_data_report_columns'`
        )
      } else {
        await c.query(
          `UPDATE system_configs SET value = $1, updated_at = NOW() WHERE key = 'nckh_data_report_columns'`,
          [oldValue]
        )
      }
      ok('Đã restore cấu hình cột cũ')
    }
  }

  await c.end()

  console.log('\n=== KẾT QUẢ ===')
  console.log(`Passed: ${passed} | Failed: ${failed}`)
  if (failures.length) {
    console.log('Chi tiết lỗi:')
    for (const f of failures) console.log(` - ${f.name}: ${f.detail}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
