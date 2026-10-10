import cors from 'cors'
import connectPgSimple from 'connect-pg-simple'
import express, { type ErrorRequestHandler } from 'express'
import session from 'express-session'
import helmet from 'helmet'
import type { Pool } from 'pg'
import type { Environment } from './config.js'
import { createAuthRouter } from './routes/auth.js'
import { createBoardsRouter } from './routes/boards.js'

export function createApp(pool: Pool, configuration: Environment) {
  const app = express()
  const PgSessionStore = connectPgSimple(session)

  app.disable('x-powered-by')
  app.set('trust proxy', configuration.NODE_ENV === 'production' ? 1 : false)
  app.use(helmet())
  app.use(cors({ origin: configuration.CLIENT_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '32kb' }))
  app.use(session({
    name: 'canvaslab.sid',
    secret: configuration.SESSION_SECRET,
    store: new PgSessionStore({ pool, tableName: 'user_sessions', createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: configuration.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }))

  app.get('/api/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1')
      response.json({ status: 'ok', database: 'connected' })
    } catch {
      response.status(503).json({ status: 'error', database: 'unavailable' })
    }
  })
  app.use('/api/auth', createAuthRouter(pool, configuration.SESSION_SECRET))
  app.use('/api/boards', createBoardsRouter(pool))
  app.use((_request, response) => response.status(404).json({ error: 'Not found' }))

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    console.error('Unhandled API error', error)
    response.status(500).json({ error: 'Internal server error' })
  }
  app.use(errorHandler)

  return app
}
