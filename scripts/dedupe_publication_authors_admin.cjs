/**
 * Gộp dòng tác giả trùng tên "Admin" trong cùng một publication_id.
 * Lưu ở bảng: publication_authors (cột publication_id, profile_id, full_name, ...).
 *
 * Giữ 1 dòng / mỗi công bố: ưu tiên profile_id = chủ bài (publications.profile_id),
 * tiếp theo profile_id khác null, cuối cùng id nhỏ nhất.
 *
 * Chạy xem trước: node scripts/dedupe_publication_authors_admin.cjs --dry-run
 * Thực xóa:   node scripts/dedupe_publication_authors_admin.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

function parseDotenv(p) {
  const txt = fs.readFileSync(p, 'utf8')
  const out = {}
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const m = s.match(/^([A-Z0-9_]+)=(.*)$/i)
    if (!m) continue
    const k = m[1]
    let v = m[2] ?? ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const env = parseDotenv(path.join(process.cwd(), '.env'))
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })
  await client.connect()

  const rankedSql = `
    WITH ranked AS (
      SELECT
        pa.id,
        pa.publication_id,
        pa.full_name,
        pa.profile_id,
        p.profile_id AS pub_owner_profile_id,
        ROW_NUMBER() OVER (
          PARTITION BY pa.publication_id
          ORDER BY
            CASE WHEN pa.profile_id IS NOT NULL AND pa.profile_id = p.profile_id THEN 0 ELSE 1 END,
            CASE WHEN pa.profile_id IS NOT NULL THEN 0 ELSE 1 END,
            pa.id
        ) AS rn
      FROM publication_authors pa
      INNER JOIN publications p ON p.id = pa.publication_id
      WHERE LOWER(TRIM(pa.full_name)) = 'admin'
    )
    SELECT id, publication_id, full_name, profile_id, pub_owner_profile_id, rn
    FROM ranked
    ORDER BY publication_id, rn
  `

  const { rows } = await client.query(rankedSql)
  const countByPub = new Map()
  for (const r of rows) {
    countByPub.set(r.publication_id, (countByPub.get(r.publication_id) || 0) + 1)
  }

  const toDelete = []
  const loggedPub = new Set()
  for (const r of rows) {
    if (r.rn > 1) {
      toDelete.push(r.id)
      continue
    }
    const dupCount = countByPub.get(r.publication_id) || 0
    if (dupCount > 1 && !loggedPub.has(r.publication_id)) {
      loggedPub.add(r.publication_id)
      console.log(
        `[publication ${r.publication_id}] giữ id=${r.id} (profile_id=${r.profile_id}), bỏ ${dupCount - 1} dòng trùng "Admin"`
      )
    }
  }

  if (toDelete.length === 0) {
    console.log('Không có dòng Admin trùng trong cùng một công bố.')
    await client.end()
    return
  }

  console.log(`\nTổng sẽ xóa: ${toDelete.length} bản ghi (id: ${toDelete.join(', ')})`)

  if (dryRun) {
    console.log('\n--dry-run: chưa xóa DB.')
    await client.end()
    return
  }

  await client.query('DELETE FROM publication_authors WHERE id = ANY($1::bigint[])', [toDelete])
  console.log('\nĐã xóa xong.')
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
