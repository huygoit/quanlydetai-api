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
  const env = parseDotenv(path.join(process.cwd(), '.env'))
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })
  await client.connect()

  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='academic_years'
     ORDER BY ordinal_position`
  )
  console.log('academic_years.columns', cols.rows)

  const count = await client.query(`SELECT COUNT(*)::int AS c FROM academic_years`)
  console.log('academic_years.count', count.rows?.[0]?.c)

  const sample = await client.query(`SELECT * FROM academic_years ORDER BY id ASC LIMIT 10`)
  console.log('academic_years.sample', sample.rows)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

