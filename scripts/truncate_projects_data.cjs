const fs = require('node:fs')
const { Client } = require('pg')

function loadEnvFromFile(filePath) {
  const env = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function main() {
  const env = loadEnvFromFile('.env')
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })

  await client.connect()
  try {
    const beforeMembers = await client.query('select count(*)::int as c from project_members')
    const beforeProjects = await client.query('select count(*)::int as c from projects')

    await client.query('begin')
    await client.query('delete from project_members')
    await client.query('delete from projects')
    await client.query('commit')

    const afterMembers = await client.query('select count(*)::int as c from project_members')
    const afterProjects = await client.query('select count(*)::int as c from projects')

    console.log(`project_members: ${beforeMembers.rows[0].c} -> ${afterMembers.rows[0].c}`)
    console.log(`projects: ${beforeProjects.rows[0].c} -> ${afterProjects.rows[0].c}`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
