import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Pool } from 'pg'
import type { Environment } from '../config.js'
import { isEmailConfigured, sendTransactionalEmail } from '../email.js'
import { requireAuth, sessionUserId } from '../auth.js'
import { acceptBoardInvitationSchema, boardIdSchema, boardInvitationSchema, boardMemberRoleSchema, boardMemberSchema, createBoardSchema, updateBoardSchema, userIdSchema } from '../validation.js'

type BoardRole = 'owner' | 'editor' | 'viewer'

interface BoardSummary {
  id: string
  title: string
  role: BoardRole
  created_at: Date
  updated_at: Date
}

interface MembershipRow {
  role: BoardRole
}

interface BoardMemberRow {
  id: string
  display_name: string
  email: string
  role: BoardRole
  created_at: Date
}

export function canEditBoard(role: BoardRole): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageBoardMembers(role: BoardRole): boolean {
  return role === 'owner'
}

function parseBoardId(value: string): string | null {
  const parsed = boardIdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

async function getMembership(pool: Pool, boardId: string, userId: string): Promise<BoardRole | null> {
  const result = await pool.query<MembershipRow>(
    'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
    [boardId, userId],
  )
  return result.rows[0]?.role ?? null
}

function parseUserId(value: string): string | null {
  const parsed = userIdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function createBoardsRouter(pool: Pool, configuration: Environment): Router {
  const router = Router()
  router.use(requireAuth)

  router.post('/invitations/accept', async (request, response) => {
    const parsed = acceptBoardInvitationSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid or expired invitation' })
      return
    }

    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const invitationResult = await client.query<{ id: string; board_id: string; email: string; role: 'editor' | 'viewer' }>(
        'SELECT id, board_id, email, role FROM board_invitations WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() FOR UPDATE',
        [tokenHash],
      )
      const invitation = invitationResult.rows[0]
      if (!invitation) {
        await client.query('ROLLBACK')
        response.status(400).json({ error: 'Invalid or expired invitation' })
        return
      }

      const userResult = await client.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [sessionUserId(request)])
      if (!userResult.rows[0] || userResult.rows[0].email.toLowerCase() !== invitation.email.toLowerCase()) {
        await client.query('ROLLBACK')
        response.status(403).json({ error: 'Sign in with the email address this invitation was sent to.' })
        return
      }

      await client.query(
        'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (board_id, user_id) DO NOTHING',
        [invitation.board_id, sessionUserId(request), invitation.role],
      )
      await client.query('UPDATE board_invitations SET accepted_at = NOW() WHERE id = $1', [invitation.id])
      await client.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [invitation.board_id])
      await client.query('COMMIT')
      response.json({ boardId: invitation.board_id, message: 'Invitation accepted.' })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  router.get('/', async (request, response) => {
    const result = await pool.query<BoardSummary>(
      `SELECT b.id, b.title, m.role, b.created_at, b.updated_at
       FROM boards b
       JOIN board_members m ON m.board_id = b.id
       WHERE m.user_id = $1
       ORDER BY b.updated_at DESC`,
      [sessionUserId(request)],
    )
    response.json({ boards: result.rows })
  })

  router.post('/', async (request, response) => {
    const parsed = createBoardSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid board title', details: parsed.error.issues })
      return
    }

    const client = await pool.connect()
    const boardId = randomUUID()
    const userId = sessionUserId(request)

    try {
      await client.query('BEGIN')
      const boardResult = await client.query<BoardSummary>(
        `INSERT INTO boards (id, title, owner_id) VALUES ($1, $2, $3)
         RETURNING id, title, created_at, updated_at`,
        [boardId, parsed.data.title, userId],
      )
      await client.query(
        "INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')",
        [boardId, userId],
      )
      await client.query('INSERT INTO board_documents (board_id) VALUES ($1)', [boardId])
      await client.query('COMMIT')
      response.status(201).json({ board: { ...boardResult.rows[0], role: 'owner' } })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  router.get('/:boardId', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    if (!boardId) {
      response.status(400).json({ error: 'Invalid board id' })
      return
    }

    const result = await pool.query<BoardSummary>(
      `SELECT b.id, b.title, m.role, b.created_at, b.updated_at
       FROM boards b
       JOIN board_members m ON m.board_id = b.id
       WHERE b.id = $1 AND m.user_id = $2`,
      [boardId, sessionUserId(request)],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    response.json({ board: result.rows[0] })
  })

  router.patch('/:boardId', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    const parsed = updateBoardSchema.safeParse(request.body)
    if (!boardId || !parsed.success) {
      response.status(400).json({ error: 'Invalid board id or title' })
      return
    }

    const userId = sessionUserId(request)
    const role = await getMembership(pool, boardId, userId)
    if (!role) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    if (!canEditBoard(role)) {
      response.status(403).json({ error: 'You do not have permission to edit this board' })
      return
    }

    const result = await pool.query<BoardSummary>(
      `UPDATE boards SET title = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, title, created_at, updated_at`,
      [parsed.data.title, boardId],
    )
    response.json({ board: { ...result.rows[0], role } })
  })

  router.delete('/:boardId', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    if (!boardId) {
      response.status(400).json({ error: 'Invalid board id' })
      return
    }

    const userId = sessionUserId(request)
    const role = await getMembership(pool, boardId, userId)
    if (!role) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    if (role !== 'owner') {
      response.status(403).json({ error: 'Only the board owner can delete it' })
      return
    }

    await pool.query('DELETE FROM boards WHERE id = $1 AND owner_id = $2', [boardId, userId])
    response.status(204).end()
  })

  router.get('/:boardId/members', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    if (!boardId) {
      response.status(400).json({ error: 'Invalid board id' })
      return
    }

    const viewerRole = await getMembership(pool, boardId, sessionUserId(request))
    if (!viewerRole) {
      response.status(404).json({ error: 'Board not found' })
      return
    }

    const result = await pool.query<BoardMemberRow>(
      `SELECT u.id, u.display_name, u.email, m.role, m.created_at
       FROM board_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.board_id = $1
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, m.created_at`,
      [boardId],
    )
    response.json({ members: result.rows.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      email: member.email,
      role: member.role,
      addedAt: member.created_at,
    })) })
  })

  router.post('/:boardId/invitations', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    const parsed = boardInvitationSchema.safeParse(request.body)
    if (!boardId || !parsed.success) {
      response.status(400).json({ error: 'Invalid board id, email, or role' })
      return
    }

    const requesterId = sessionUserId(request)
    const requesterRole = await getMembership(pool, boardId, requesterId)
    if (!requesterRole) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    if (requesterRole !== 'owner') {
      response.status(403).json({ error: 'Only the board owner can invite collaborators' })
      return
    }
    const email = parsed.data.email.toLowerCase()
    const existingMember = await pool.query(
      'SELECT 1 FROM board_members m JOIN users u ON u.id = m.user_id WHERE m.board_id = $1 AND LOWER(u.email) = $2',
      [boardId, email],
    )
    if (existingMember.rowCount) {
      response.status(409).json({ error: 'That account is already a member of this board.' })
      return
    }

    const boardResult = await pool.query<{ title: string }>('SELECT title FROM boards WHERE id = $1', [boardId])
    const inviterResult = await pool.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [requesterId])
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const invitationId = randomUUID()
    await pool.query(
      'INSERT INTO board_invitations (id, board_id, email, role, invited_by, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL \'7 days\')',
      [invitationId, boardId, email, parsed.data.role, requesterId, tokenHash],
    )

    const invitationUrl = new URL('/login', configuration.APP_BASE_URL)
    invitationUrl.searchParams.set('inviteToken', token)
    let emailSent = false
    if (isEmailConfigured(configuration)) {
      try {
        await sendTransactionalEmail(configuration, {
          to: email,
          subject: `You’re invited to collaborate on ${boardResult.rows[0]?.title ?? 'a CanvasLab board'}`,
          text: `${inviterResult.rows[0]?.display_name ?? 'A CanvasLab user'} invited you to a board as ${parsed.data.role}. Sign in or create an account using ${email}, then accept the invitation here: ${invitationUrl.toString()}. This link expires in 7 days.`,
          html: `<p>${inviterResult.rows[0]?.display_name ?? 'A CanvasLab user'} invited you to a board as ${parsed.data.role}.</p><p>Sign in or create an account using ${email}, then <a href="${invitationUrl.toString()}">accept the invitation</a>. This link expires in 7 days.</p>`,
        })
        emailSent = true
      } catch (error) {
        // Keep the invitation usable: the owner can copy and share the secure link manually.
        console.error('Board invitation email delivery failed; manual link sharing remains available', error)
      }
    }

    response.status(201).json({
      invitation: {
        email,
        role: parsed.data.role,
        expiresInDays: 7,
        invitationUrl: invitationUrl.toString(),
        emailSent,
      },
    })
  })

  router.post('/:boardId/members', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    const parsed = boardMemberSchema.safeParse(request.body)
    if (!boardId || !parsed.success) {
      response.status(400).json({ error: 'Invalid board id, email, or role' })
      return
    }

    const requesterId = sessionUserId(request)
    const requesterRole = await getMembership(pool, boardId, requesterId)
    if (!requesterRole) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    if (!canManageBoardMembers(requesterRole)) {
      response.status(403).json({ error: 'Only the board owner can manage members' })
      return
    }

    const userResult = await pool.query<Pick<BoardMemberRow, 'id' | 'display_name' | 'email'>>(
      'SELECT id, display_name, email FROM users WHERE LOWER(email) = $1',
      [parsed.data.email.toLowerCase()],
    )
    const invitedUser = userResult.rows[0]
    if (!invitedUser) {
      response.status(404).json({ error: 'No account uses that email yet. They must register before you can add them.' })
      return
    }
    if (invitedUser.id === requesterId) {
      response.status(409).json({ error: 'You already own this board' })
      return
    }

    const result = await pool.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO NOTHING
       RETURNING created_at`,
      [boardId, invitedUser.id, parsed.data.role],
    )
    if (!result.rows[0]) {
      response.status(409).json({ error: 'That user is already a member of this board' })
      return
    }

    await pool.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [boardId])
    response.status(201).json({ member: {
      id: invitedUser.id,
      displayName: invitedUser.display_name,
      email: invitedUser.email,
      role: parsed.data.role,
      addedAt: result.rows[0].created_at,
    } })
  })

  router.patch('/:boardId/members/:userId', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    const userId = parseUserId(request.params.userId!)
    const parsed = boardMemberRoleSchema.safeParse(request.body)
    if (!boardId || !userId || !parsed.success) {
      response.status(400).json({ error: 'Invalid board id, member id, or role' })
      return
    }

    const requesterRole = await getMembership(pool, boardId, sessionUserId(request))
    if (!requesterRole) {
      response.status(404).json({ error: 'Board not found' })
      return
    }
    if (!canManageBoardMembers(requesterRole)) {
      response.status(403).json({ error: 'Only the board owner can manage members' })
      return
    }

    const result = await pool.query<MembershipRow>(
      `UPDATE board_members SET role = $1
       WHERE board_id = $2 AND user_id = $3 AND role <> 'owner'
       RETURNING role`,
      [parsed.data.role, boardId, userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: 'Board member not found or is the owner' })
      return
    }

    await pool.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [boardId])
    response.json({ member: { id: userId, role: result.rows[0].role } })
  })

  router.delete('/:boardId/members/:userId', async (request, response) => {
    const boardId = parseBoardId(request.params.boardId!)
    const userId = parseUserId(request.params.userId!)
    if (!boardId || !userId) {
      response.status(400).json({ error: 'Invalid board id or member id' })
      return
    }

    const requesterId = sessionUserId(request)
    const requesterRole = await getMembership(pool, boardId, requesterId)
    if (!requesterRole) {
      response.status(404).json({ error: 'Board not found' })
      return
    }

    const targetRole = await getMembership(pool, boardId, userId)
    if (!targetRole) {
      response.status(404).json({ error: 'Board member not found' })
      return
    }
    if (targetRole === 'owner') {
      response.status(409).json({ error: 'The board owner cannot be removed' })
      return
    }
    if (!canManageBoardMembers(requesterRole) && requesterId !== userId) {
      response.status(403).json({ error: 'Only the board owner can remove another member' })
      return
    }

    await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId])
    await pool.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [boardId])
    response.status(204).end()
  })

  return router
}
