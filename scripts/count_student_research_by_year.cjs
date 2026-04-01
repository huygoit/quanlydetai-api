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

  const r = await client.query(`
    SELECT year, COUNT(*)::int AS n
    FROM projects
    WHERE deleted_at IS NULL AND project_type = 'STUDENT_RESEARCH'
    GROUP BY year
    ORDER BY year NULLS LAST
  `)
  console.log('STUDENT_RESEARCH theo projects.year:')
  console.table(r.rows)

  const r2 = await client.query(`
    SELECT
      EXTRACT(YEAR FROM created_at)::int AS created_year,
      COUNT(*)::int AS n
    FROM projects
    WHERE deleted_at IS NULL AND project_type = 'STUDENT_RESEARCH'
    GROUP BY EXTRACT(YEAR FROM created_at)
    ORDER BY created_year
  `)
  console.log('STUDENT_RESEARCH theo năm created_at:')
  console.table(r2.rows)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
