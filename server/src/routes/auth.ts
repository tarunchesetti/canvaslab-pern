import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Router, type Request } from 'express'
import type { Pool } from 'pg'
import { requireAuth } from '../auth.js'
import { createCollaborationToken } from '../collaboration-token.js'
import { loginSchema, registerSchema } from '../validation.js'

interface UserRow {
  id: string
  display_name: string
  email: string
  password_hash: string
}

function startUserSession(request: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError)
        return
      }

      request.session.userId = userId
      request.session.save((saveError) => saveError ? reject(saveError) : resolve())
    })
  })
}

function publicUser(user: Pick<UserRow, 'id' | 'display_name' | 'email'>) {
  return { id: user.id, displayName: user.display_name, email: user.email }
}

export function createAuthRouter(pool: Pool, sessionSecret: string): Router {
  const router = Router()

  router.post('/register', async (request, response) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid registration details', details: parsed.error.issues })
      return
    }

    const { displayName, password } = parsed.data
    const email = parsed.data.email.toLowerCase()
    const passwordHash = await bcrypt.hash(password, 12)
    const id = randomUUID()

    try {
      const result = await pool.query<UserRow>(
        'INSERT INTO users (id, display_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, display_name, email',
        [id, displayName, email, passwordHash],
      )
      await startUserSession(request, id)
      response.status(201).json({ user: publicUser(result.rows[0]!) })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        response.status(409).json({ error: 'An account with that email already exists' })
        return
      }
      throw error
    }
  })

  router.post('/login', async (request, response) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid login details' })
      return
    }

    const email = parsed.data.email.toLowerCase()
    const result = await pool.query<UserRow>(
      'SELECT id, display_name, email, password_hash FROM users WHERE LOWER(email) = $1',
      [email],
    )
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      response.status(401).json({ error: 'Email or password is incorrect' })
      return
    }

    await startUserSession(request, user.id)
    response.json({ user: publicUser(user) })
  })

  router.post('/logout', requireAuth, async (request, response) => {
    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) => error ? reject(error) : resolve())
    })
    response.clearCookie('canvaslab.sid', { httpOnly: true, sameSite: 'lax', secure: request.secure })
    response.status(204).end()
  })

  router.get('/me', requireAuth, async (request, response) => {
    const result = await pool.query<Pick<UserRow, 'id' | 'display_name' | 'email'>>(
      'SELECT id, display_name, email FROM users WHERE id = $1',
      [request.session.userId],
    )
    const user = result.rows[0]
    if (!user) {
      response.status(401).json({ error: 'Authentication required' })
      return
    }
    response.json({ user: publicUser(user) })
  })

  router.post('/collaboration-token', requireAuth, async (request, response) => {
    const token = await createCollaborationToken(request.session.userId!, sessionSecret)
    response.json({ token, expiresInSeconds: 300 })
  })

  return router
}
