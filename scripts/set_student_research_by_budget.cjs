const fs = require('node:fs')
const { Client } = require('pg')

function loadEnv(filePath) {
  const env = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const idx = t.indexOf('=')
    const key = t.slice(0, idx).trim()
    let val = t.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

async function main() {
  const env = loadEnv('.env')
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })

  await client.connect()
  try {
    const before = await client.query(
      "SELECT count(*)::int AS c FROM projects WHERE budget_total IS NULL OR budget_total = 0"
    )

    const updated = await client.query(
      "UPDATE projects SET project_type = 'STUDENT_RESEARCH', updated_at = NOW() WHERE budget_total IS NULL OR budget_total = 0"
    )

    const afterStudent = await client.query(
      "SELECT count(*)::int AS c FROM projects WHERE (budget_total IS NULL OR budget_total = 0) AND project_type = 'STUDENT_RESEARCH'"
    )

    console.log(`rows without budget: ${before.rows[0].c}`)
    console.log(`updated rows: ${updated.rowCount}`)
    console.log(`rows now student_research: ${afterStudent.rows[0].c}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
