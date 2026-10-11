import { createApp } from './app.js'
import { createCollaborationServer } from './collaboration.js'
import { environment } from './config.js'
import { pool } from './db.js'

const apiServer = environment.SERVICE_ROLE === 'collab'
  ? null
  : createApp(pool, environment).listen(environment.PORT, () => {
      console.log(`CanvasLab API listening on port ${environment.PORT}`)
    })

const collaborationServer = environment.SERVICE_ROLE === 'api'
  ? null
  : createCollaborationServer(
      pool,
      environment.SESSION_SECRET,
      environment.SERVICE_ROLE === 'collab' ? environment.PORT : environment.COLLAB_PORT,
    )

if (collaborationServer) {
  collaborationServer.listen()
  console.log(`CanvasLab collaboration server starting on port ${environment.SERVICE_ROLE === 'collab' ? environment.PORT : environment.COLLAB_PORT}`)
}

async function shutdown() {
  if (collaborationServer) await collaborationServer.destroy()
  if (apiServer) {
    apiServer.close(async () => {
      await pool.end()
      process.exit(0)
    })
  } else {
    await pool.end()
    process.exit(0)
  }
}

process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
