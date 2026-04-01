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

function pad3(n) {
  return String(n).padStart(3, '0')
}

async function main() {
  const env = parseDotenv(path.join(process.cwd(), '.env'))
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })

  await client.connect()

  const targetYear = 2025
  const fromPrefix = `KN-${new Date().getFullYear()}-`
  const toPrefix = `KN-${targetYear}-`

  const candidates = await client.query(
    `
    SELECT id, code, note
    FROM startup_projects
    WHERE code LIKE $1
      AND (note IS NULL OR note NOT ILIKE '%year=%')
      AND created_at::date = CURRENT_DATE
    ORDER BY id ASC
  `,
    [`${fromPrefix}%`]
  )

  if (candidates.rowCount === 0) {
    console.log('Không có dự án nào cần sửa (code năm hiện tại nhưng note thiếu year=...)')
    await client.end()
    return
  }

  const last = await client.query(
    `SELECT code FROM startup_projects WHERE code LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${toPrefix}%`]
  )
  let seq = 1
  if (last.rowCount === 1) {
    const parts = String(last.rows[0].code || '').split('-')
    const n = parseInt(parts[2] || '0', 10)
    if (!Number.isNaN(n) && n > 0) seq = n + 1
  }

  await client.query('BEGIN')
  try {
    for (const row of candidates.rows) {
      const newCode = `${toPrefix}${pad3(seq++)}`
      const note = row.note ? String(row.note) : ''
      const newNote = [note, `year=${targetYear}`].filter(Boolean).join('; ')
      await client.query(`UPDATE startup_projects SET code=$1, note=$2, updated_at=NOW() WHERE id=$3`, [
        newCode,
        newNote,
        row.id,
      ])
      console.log(`Sửa startup_projects id=${row.id}: ${row.code} -> ${newCode}`)
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

