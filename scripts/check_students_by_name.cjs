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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

async function main() {
  const envPath = path.join(process.cwd(), '.env')
  const env = parseDotenv(envPath)

  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })

  await client.connect()

  const names = process.argv.slice(2).filter(Boolean)
  const effectiveNames =
    names.length > 0
      ? names
      : [
          'Phạm Nguyễn Nhật Minh',
          'Võ Thị Kim Hiên',
          'Huỳnh Lâm Anh Thư',
          'Nguyễn Trần Diệu Thảo',
          'Lê Anh Tú',
          'Nguyễn Trúc Linh',
          'Nguyễn Thanh Hằng',
        ]

  for (const name of effectiveNames) {
    const r = await client.query(
      `SELECT id, student_code, full_name
       FROM students
       WHERE LOWER(full_name) = LOWER($1)
       LIMIT 20`,
      [name]
    )
    const sample = r.rows.slice(0, 3).map((x) => `${x.id}:${x.student_code || ''}:${x.full_name}`).join(' | ')
    console.log(`${name} => ${r.rowCount}${sample ? ` (ví dụ: ${sample})` : ''}`)
  }

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

