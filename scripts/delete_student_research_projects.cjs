/**
 * Xóa toàn bộ projects loại STUDENT_RESEARCH và project_members liên quan (CASCADE).
 * Dùng trước khi import lại file SV NCKH.
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
    let v = m[2] ?? ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
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

  const r = await client.query(
    `DELETE FROM projects WHERE project_type = 'STUDENT_RESEARCH' RETURNING id`
  )
  console.log('Đã xóa', r.rowCount, 'bản ghi projects (STUDENT_RESEARCH).')

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
