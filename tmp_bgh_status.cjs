const { Client } = require('pg')
require('dotenv').config()
;(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  })
  await c.connect()
  const o = await c.query(
    `select id, code, status, revision_gate_status, bgh_signed_at, module5_opened, active_contract_id
     from project_outlines where id=1`
  )
  console.log('outline', o.rows[0])
  const a = await c.query(
    `select id, action, from_status, to_status, created_at
     from project_outline_audits where project_outline_id=1
     order by id desc limit 8`
  )
  console.log('audits', a.rows)
  await c.end()
})()
