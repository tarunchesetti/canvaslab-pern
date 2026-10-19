import bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Router, type Request } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Pool } from 'pg'
import type { Environment } from '../config.js'
import { isEmailConfigured, sendTransactionalEmail } from '../email.js'
import { requireAuth } from '../auth.js'
import { createCollaborationToken } from '../collaboration-token.js'
import { loginSchema, passwordResetCompleteSchema, passwordResetRequestSchema, registerSchema } from '../validation.js'

interface UserRow {
  id: string
  display_name: string
  email: string
  password_hash: string | null
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

export function createAuthRouter(pool: Pool, sessionSecret: string, configuration: Environment): Router {
  const router = Router()

  router.get('/google', async (request, response) => {
    if (!configuration.GOOGLE_CLIENT_ID || !configuration.GOOGLE_CLIENT_SECRET || !configuration.GOOGLE_REDIRECT_URI) {
      response.redirect(new URL('/?authError=google', configuration.APP_BASE_URL).toString())
      return
    }

    const state = randomBytes(32).toString('base64url')
    const session = request.session as typeof request.session & { googleOAuthState?: string; googleOAuthReturnTo?: string }
    session.googleOAuthState = state
    const requestedReturnTo = typeof request.query.returnTo === 'string' ? request.query.returnTo : '/'
    session.googleOAuthReturnTo = requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//') && !requestedReturnTo.includes('\\') ? requestedReturnTo : '/'
    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => error ? reject(error) : resolve())
    })

    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizationUrl.search = new URLSearchParams({
      client_id: configuration.GOOGLE_CLIENT_ID,
      redirect_uri: configuration.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString()
    response.redirect(authorizationUrl.toString())
  })

  router.get('/google/callback', async (request, response) => {
    const redirectToLogin = () => response.redirect(new URL('/?authError=google', configuration.APP_BASE_URL).toString())
    const session = request.session as typeof request.session & { googleOAuthState?: string; googleOAuthReturnTo?: string }
    const state = typeof request.query.state === 'string' ? request.query.state : ''
    const code = typeof request.query.code === 'string' ? request.query.code : ''
    const expectedState = session.googleOAuthState
    const returnTo = session.googleOAuthReturnTo ?? '/'
    delete session.googleOAuthState
    delete session.googleOAuthReturnTo

    if (!expectedState || !state || state !== expectedState || !code || request.query.error) {
      redirectToLogin()
      return
    }

    if (!configuration.GOOGLE_CLIENT_ID || !configuration.GOOGLE_CLIENT_SECRET || !configuration.GOOGLE_REDIRECT_URI) {
      redirectToLogin()
      return
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: configuration.GOOGLE_CLIENT_ID,
        client_secret: configuration.GOOGLE_CLIENT_SECRET,
        redirect_uri: configuration.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tokenPayload = await tokenResponse.json() as { id_token?: string }
    if (!tokenResponse.ok || !tokenPayload.id_token) {
      redirectToLogin()
      return
    }

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload']
    try {
      const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
      const verified = await jwtVerify(tokenPayload.id_token, googleKeys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: configuration.GOOGLE_CLIENT_ID,
      })
      payload = verified.payload
    } catch {
      redirectToLogin()
      return
    }
    if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email.trim()) {
      redirectToLogin()
      return
    }

    const email = payload.email.trim().toLowerCase()
    let user = (await pool.query<UserRow>(
      'SELECT id, display_name, email, password_hash FROM users WHERE LOWER(email) = $1',
      [email],
    )).rows[0]

    if (!user) {
      const id = randomUUID()
      const displayName = typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim().slice(0, 80)
        : email.split('@')[0]!.slice(0, 80)
      try {
        const result = await pool.query<UserRow>(
          'INSERT INTO users (id, display_name, email, password_hash) VALUES ($1, $2, $3, NULL) RETURNING id, display_name, email, password_hash',
          [id, displayName, email],
        )
        user = result.rows[0]
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== '23505') throw error
        user = (await pool.query<UserRow>(
          'SELECT id, display_name, email, password_hash FROM users WHERE LOWER(email) = $1',
          [email],
        )).rows[0]
      }
    }

    if (!user) {
      redirectToLogin()
      return
    }
    await startUserSession(request, user.id)
    const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : '/'
    response.redirect(new URL(safeReturnTo, configuration.APP_BASE_URL).toString())
  })

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
    if (!user || !user.password_hash || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      response.status(401).json({ error: 'Email or password is incorrect' })
      return
    }

    await startUserSession(request, user.id)
    response.json({ user: publicUser(user) })
  })

  router.post('/password-reset/request', async (request, response) => {
    const parsed = passwordResetRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Enter a valid email address' })
      return
    }

    if (!isEmailConfigured(configuration) && configuration.NODE_ENV !== 'development') {
      response.status(503).json({ error: 'Password recovery email is not configured. Contact the server administrator.' })
      return
    }

    const email = parsed.data.email.toLowerCase()
    const result = await pool.query<Pick<UserRow, 'id' | 'email'>>(
      'SELECT id, email FROM users WHERE LOWER(email) = $1',
      [email],
    )
    const user = result.rows[0]
    if (!user) {
      response.status(202).json({ message: 'If an account exists for that email, a password reset link will be sent.' })
      return
    }

    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const tokenId = randomUUID()
    await pool.query(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'30 minutes\')',
      [tokenId, user.id, tokenHash],
    )

    const resetUrl = new URL('/', configuration.APP_BASE_URL)
    resetUrl.searchParams.set('resetToken', token)

    // In local development, expose a one-time reset link in the response so the flow
    // can be tested without configuring an email provider. Never do this in production.
    if (!isEmailConfigured(configuration)) {
      response.status(202).json({
        message: 'For local development, use the reset link below. It expires in 30 minutes.',
        resetUrl: resetUrl.toString(),
      })
      return
    }

    try {
      await sendTransactionalEmail(configuration, {
        to: user.email,
        subject: 'Reset your CanvasLab password',
        text: `Use this link to reset your CanvasLab password. It expires in 30 minutes: ${resetUrl.toString()}`,
        html: `<p>Use the link below to reset your CanvasLab password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`,
      })
    } catch (error) {
      await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [tokenId])
      console.error('Password reset email delivery failed', error)
      // Keep the response generic so email delivery failures do not reveal account state.
    }

    response.status(202).json({ message: 'If an account exists for that email, a password reset link will be sent.' })
  })

  router.post('/password-reset/complete', async (request, response) => {
    const parsed = passwordResetCompleteSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid or expired password reset link' })
      return
    }

    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const tokenResult = await client.query<{ id: string; user_id: string }>(
        'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE',
        [tokenHash],
      )
      const reset = tokenResult.rows[0]
      if (!reset) {
        await client.query('ROLLBACK')
        response.status(400).json({ error: 'Invalid or expired password reset link' })
        return
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.user_id])
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [reset.id])
      await client.query("DELETE FROM user_sessions WHERE sess->>'userId' = $1", [reset.user_id])
      await client.query('COMMIT')
      response.json({ message: 'Password reset successfully. Please sign in with your new password.' })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
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
