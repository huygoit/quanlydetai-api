const { Client } = require('pg')
const c = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'root',
  database: 'quanlydetai',
})
async function main() {
  await c.connect()
  const agg = await c.query(`
    SELECT status, count(*)::int AS n, max(created_at) AS last_at
    FROM email_logs
    WHERE related_type = 'call_for_proposal' AND related_id = 4
    GROUP BY status
  `)
  const job = await c.query(`SELECT id, status, total, sent, error, updated_at FROM cfp_email_jobs WHERE id=4`)
  console.log(agg.rows, job.rows[0])
  await c.end()
}
main()
