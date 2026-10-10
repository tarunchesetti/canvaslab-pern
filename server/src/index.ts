import { createApp } from './app.js'
import { createCollaborationServer } from './collaboration.js'
import { environment } from './config.js'
import { pool } from './db.js'

const app = createApp(pool, environment)
const collaborationServer = createCollaborationServer(pool, environment.SESSION_SECRET, environment.COLLAB_PORT)
const server = app.listen(environment.PORT, () => {
  console.log(`CanvasLab API listening on http://localhost:${environment.PORT}`)
})
collaborationServer.listen()

async function shutdown() {
  await collaborationServer.destroy()
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
