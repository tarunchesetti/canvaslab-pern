import { createApp } from './app.js'
import { environment } from './config.js'
import { pool } from './db.js'

const app = createApp(pool, environment)
const server = app.listen(environment.PORT, () => {
  console.log(`CanvasLab API listening on http://localhost:${environment.PORT}`)
})

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
