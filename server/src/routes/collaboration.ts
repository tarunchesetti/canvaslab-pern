import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { requireAuth, sessionUserId } from '../auth.js'
import { boardIdSchema } from '../validation.js'

type Role = 'owner' | 'editor' | 'viewer'
const commentSchema = z.object({ body: z.string().trim().min(1).max(5000), elementId: z.string().trim().min(1).max(180).nullable().optional(), parentCommentId: z.string().uuid().nullable().optional() })
const taskSchema = z.object({ title: z.string().trim().min(1).max(240), description: z.string().max(5000).optional(), elementId: z.string().trim().min(1).max(180).nullable().optional(), assigneeId: z.string().uuid().nullable().optional(), status: z.enum(['todo', 'in_progress', 'done']).optional(), priority: z.enum(['low', 'normal', 'high']).optional(), dueAt: z.string().datetime().nullable().optional() })
const sessionSchema = z.object({ type: z.enum(['brainstorm', 'voting']), title: z.string().trim().min(1).max(160), voteLimit: z.number().int().min(1).max(20).default(3) })
const voteSchema = z.object({ elementId: z.string().trim().min(1).max(180) })
const snapshotSchema = z.object({ label: z.string().trim().min(1).max(160) })
const templateSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(500).default(''), category: z.string().trim().min(1).max(40).default('general'), document: z.record(z.string(), z.unknown()).default({}) })

async function getRole(pool: Pool, boardId: string, userId: string): Promise<Role | null> {
  const result = await pool.query<{ role: Role }>('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId])
  return result.rows[0]?.role ?? null
}
function parseBoardId(value: string): string | null {
  const parsed = boardIdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
function canEdit(role: Role): boolean { return role === 'owner' || role === 'editor' }

async function recordActivity(pool: Pool, boardId: string, actorId: string, eventType: string, payload: Record<string, unknown>, title: string, body = '') {
  const eventId = randomUUID()
  await pool.query('INSERT INTO board_activity (id, board_id, actor_id, event_type, payload) VALUES ($1, $2, $3, $4, $5)', [eventId, boardId, actorId, eventType, JSON.stringify(payload)])
  await pool.query("INSERT INTO user_notifications (id, user_id, board_id, event_id, title, body) SELECT gen_random_uuid(), bm.user_id, $1, $2, $3, $4 FROM board_members bm WHERE bm.board_id = $1 AND bm.user_id <> $5", [boardId, eventId, title, body, actorId])
}

export function createCollaborationRouter(pool: Pool): Router {
  const router = Router()
  router.use(requireAuth)

  router.get('/boards/:boardId/comments', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const result = await pool.query("SELECT c.id, c.board_id, c.element_id, c.parent_comment_id, c.author_id, u.display_name AS author_name, c.body, c.resolved_at, c.created_at, c.updated_at FROM board_comments c JOIN users u ON u.id = c.author_id WHERE c.board_id = $1 ORDER BY c.created_at ASC LIMIT 500", [boardId])
    return res.json({ comments: result.rows })
  })

  router.post('/boards/:boardId/comments', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = commentSchema.safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid comment' })
    const userId = sessionUserId(req)
    if (!await getRole(pool, boardId, userId)) return res.status(404).json({ error: 'Board not found' })
    if (parsed.data.parentCommentId) {
      const parent = await pool.query('SELECT id FROM board_comments WHERE id = $1 AND board_id = $2', [parsed.data.parentCommentId, boardId])
      if (!parent.rowCount) return res.status(400).json({ error: 'Reply target was not found on this board' })
    }
    const id = randomUUID()
    const result = await pool.query("INSERT INTO board_comments (id, board_id, element_id, parent_comment_id, author_id, body) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, board_id, element_id, parent_comment_id, author_id, body, resolved_at, created_at, updated_at", [id, boardId, parsed.data.elementId ?? null, parsed.data.parentCommentId ?? null, userId, parsed.data.body])
    await recordActivity(pool, boardId, userId, parsed.data.parentCommentId ? 'comment.replied' : 'comment.created', { commentId: id, elementId: parsed.data.elementId ?? null }, parsed.data.parentCommentId ? 'New comment reply' : 'New board comment', parsed.data.body.slice(0, 300))
    const author = await pool.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [userId])
    return res.status(201).json({ comment: { ...result.rows[0], author_name: author.rows[0]?.display_name } })
  })

  router.patch('/boards/:boardId/comments/:commentId', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = z.object({ resolved: z.boolean() }).safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid comment update' })
    const role = await getRole(pool, boardId, sessionUserId(req))
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    const result = await pool.query('UPDATE board_comments SET resolved_at = CASE WHEN $1 THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2 AND board_id = $3 RETURNING id, resolved_at', [parsed.data.resolved, req.params.commentId, boardId])
    if (!result.rowCount) return res.status(404).json({ error: 'Comment not found' })
    return res.json({ comment: result.rows[0] })
  })

  router.get('/boards/:boardId/tasks', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const result = await pool.query("SELECT t.*, a.display_name AS assignee_name, c.display_name AS creator_name FROM board_tasks t LEFT JOIN users a ON a.id = t.assignee_id JOIN users c ON c.id = t.created_by WHERE t.board_id = $1 ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.updated_at DESC LIMIT 500", [boardId])
    return res.json({ tasks: result.rows })
  })

  router.post('/boards/:boardId/tasks', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = taskSchema.safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid task' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    if (parsed.data.assigneeId) {
      const member = await pool.query('SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, parsed.data.assigneeId])
      if (!member.rowCount) return res.status(400).json({ error: 'Assignee must be a board member' })
    }
    const id = randomUUID()
    const result = await pool.query("INSERT INTO board_tasks (id, board_id, element_id, title, description, assignee_id, created_by, status, priority, due_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [id, boardId, parsed.data.elementId ?? null, parsed.data.title, parsed.data.description ?? '', parsed.data.assigneeId ?? null, userId, parsed.data.status ?? 'todo', parsed.data.priority ?? 'normal', parsed.data.dueAt ?? null])
    await recordActivity(pool, boardId, userId, 'task.created', { taskId: id, title: parsed.data.title }, 'New task created', parsed.data.title)
    return res.status(201).json({ task: result.rows[0] })
  })

  router.patch('/boards/:boardId/tasks/:taskId', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = taskSchema.partial().safeParse(req.body)
    if (!boardId || !parsed.success || Object.keys(parsed.data).length === 0) return res.status(400).json({ error: 'Invalid task update' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    if (parsed.data.assigneeId) {
      const member = await pool.query('SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, parsed.data.assigneeId])
      if (!member.rowCount) return res.status(400).json({ error: 'Assignee must be a board member' })
    }
    const p = parsed.data
    const result = await pool.query("UPDATE board_tasks SET title = COALESCE($1,title), description = COALESCE($2,description), element_id = COALESCE($3,element_id), assignee_id = CASE WHEN $4 THEN $5::uuid ELSE assignee_id END, status = COALESCE($6,status), priority = COALESCE($7,priority), due_at = CASE WHEN $8 THEN $9::timestamptz ELSE due_at END, updated_at = NOW() WHERE id = $10 AND board_id = $11 RETURNING *", [p.title ?? null, p.description ?? null, p.elementId ?? null, p.assigneeId !== undefined, p.assigneeId ?? null, p.status ?? null, p.priority ?? null, p.dueAt !== undefined, p.dueAt ?? null, req.params.taskId, boardId])
    if (!result.rowCount) return res.status(404).json({ error: 'Task not found' })
    await recordActivity(pool, boardId, userId, 'task.updated', { taskId: req.params.taskId, status: p.status }, 'Task updated', p.title ?? p.status ?? 'Task details changed')
    return res.json({ task: result.rows[0] })
  })

  router.get('/boards/:boardId/sessions', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const sessions = await pool.query("SELECT s.*, u.display_name AS creator_name FROM board_sessions s JOIN users u ON u.id = s.created_by WHERE s.board_id = $1 ORDER BY s.created_at DESC LIMIT 100", [boardId])
    const votes = await pool.query("SELECT v.session_id, v.element_id, COUNT(*)::int AS vote_count FROM session_votes v JOIN board_sessions s ON s.id = v.session_id WHERE s.board_id = $1 GROUP BY v.session_id, v.element_id", [boardId])
    return res.json({ sessions: sessions.rows, voteCounts: votes.rows })
  })

  router.post('/boards/:boardId/sessions', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = sessionSchema.safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid session' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    const id = randomUUID()
    const result = await pool.query('INSERT INTO board_sessions (id, board_id, type, title, vote_limit, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [id, boardId, parsed.data.type, parsed.data.title, parsed.data.voteLimit, userId])
    await recordActivity(pool, boardId, userId, 'session.started', { sessionId: id, type: parsed.data.type }, 'Collaboration session started', parsed.data.title)
    return res.status(201).json({ session: result.rows[0] })
  })

  router.post('/sessions/:sessionId/votes', async (req, res) => {
    const parsed = voteSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid vote' })
    const userId = sessionUserId(req)
    const result = await pool.query<{ id: string; board_id: string; status: string; vote_limit: number }>('SELECT id, board_id, status, vote_limit FROM board_sessions WHERE id = $1', [req.params.sessionId])
    const current = result.rows[0]
    if (!current || !await getRole(pool, current.board_id, userId)) return res.status(404).json({ error: 'Session not found' })
    if (current.status !== 'active') return res.status(409).json({ error: 'Voting is closed' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const lockedSession = await client.query<{ status: string; vote_limit: number }>('SELECT status, vote_limit FROM board_sessions WHERE id = $1 FOR UPDATE', [current.id])
      if (!lockedSession.rows[0] || lockedSession.rows[0].status !== 'active') {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'Voting is closed' })
      }
      const used = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM session_votes WHERE session_id = $1 AND user_id = $2', [current.id, userId])
      const exists = await client.query('SELECT 1 FROM session_votes WHERE session_id = $1 AND element_id = $2 AND user_id = $3', [current.id, parsed.data.elementId, userId])
      if (exists.rowCount) {
        await client.query('DELETE FROM session_votes WHERE session_id = $1 AND element_id = $2 AND user_id = $3', [current.id, parsed.data.elementId, userId])
        await client.query('COMMIT')
        return res.json({ voted: false })
      }
      if (Number(used.rows[0]?.count ?? 0) >= lockedSession.rows[0].vote_limit) {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'You have used all your votes for this session' })
      }
      await client.query('INSERT INTO session_votes (session_id, element_id, user_id) VALUES ($1,$2,$3)', [current.id, parsed.data.elementId, userId])
      await client.query('COMMIT')
      return res.status(201).json({ voted: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  router.post('/sessions/:sessionId/close', async (req, res) => {
    const userId = sessionUserId(req)
    const session = await pool.query<{ board_id: string }>('SELECT board_id FROM board_sessions WHERE id = $1', [req.params.sessionId])
    const current = session.rows[0]
    if (!current || !await getRole(pool, current.board_id, userId)) return res.status(404).json({ error: 'Session not found' })
    if (!canEdit((await getRole(pool, current.board_id, userId))!)) return res.status(403).json({ error: 'Editor access required' })
    const result = await pool.query("UPDATE board_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *", [req.params.sessionId])
    return res.json({ session: result.rows[0] })
  })

  router.get('/boards/:boardId/activity', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const result = await pool.query("SELECT a.id, a.event_type, a.payload, a.created_at, u.display_name AS actor_name FROM board_activity a LEFT JOIN users u ON u.id = a.actor_id WHERE a.board_id = $1 ORDER BY a.created_at DESC LIMIT 100", [boardId])
    return res.json({ activity: result.rows })
  })

  router.get('/notifications', async (req, res) => {
    const result = await pool.query("SELECT n.id, n.board_id, n.title, n.body, n.read_at, n.created_at, b.title AS board_title FROM user_notifications n LEFT JOIN boards b ON b.id = n.board_id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 100", [sessionUserId(req)])
    return res.json({ notifications: result.rows })
  })
  router.patch('/notifications/:notificationId/read', async (req, res) => {
    const result = await pool.query('UPDATE user_notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, read_at', [req.params.notificationId, sessionUserId(req)])
    if (!result.rowCount) return res.status(404).json({ error: 'Notification not found' })
    return res.json({ notification: result.rows[0] })
  })

  router.get('/boards/:boardId/snapshots', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const result = await pool.query('SELECT id, label, document_version, created_by, created_at FROM board_snapshots WHERE board_id = $1 ORDER BY created_at DESC LIMIT 50', [boardId])
    return res.json({ snapshots: result.rows })
  })
  router.post('/boards/:boardId/snapshots', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = snapshotSchema.safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid snapshot' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    const id = randomUUID()
    const result = await pool.query('INSERT INTO board_snapshots (id, board_id, label, document_snapshot, document_version, created_by) SELECT $1, d.board_id, $2, d.snapshot, d.version, $3 FROM board_documents d WHERE d.board_id = $4 RETURNING id, label, document_version, created_by, created_at', [id, parsed.data.label, userId, boardId])
    if (!result.rowCount) return res.status(404).json({ error: 'Board document not found' })
    await pool.query('DELETE FROM board_snapshots WHERE board_id = $1 AND id NOT IN (SELECT id FROM board_snapshots WHERE board_id = $1 ORDER BY created_at DESC LIMIT 50)', [boardId])
    return res.status(201).json({ snapshot: result.rows[0] })
  })

  router.get('/templates', async (req, res) => {
    const result = await pool.query("SELECT id, owner_id, title, description, category, document, is_public, created_at FROM board_templates WHERE is_public = TRUE OR owner_id = $1 ORDER BY is_public DESC, created_at DESC LIMIT 100", [sessionUserId(req)])
    return res.json({ templates: result.rows })
  })
  router.post('/templates', async (req, res) => {
    const parsed = templateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid template' })
    const result = await pool.query('INSERT INTO board_templates (id, owner_id, title, description, category, document) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, owner_id, title, description, category, document, is_public, created_at', [randomUUID(), sessionUserId(req), parsed.data.title, parsed.data.description, parsed.data.category, JSON.stringify(parsed.data.document)])
    return res.status(201).json({ template: result.rows[0] })
  })


  const decisionSchema = z.object({
    title: z.string().trim().min(1).max(240),
    rationale: z.string().max(5000).default(''),
    ownerId: z.string().uuid().nullable().optional(),
    sourceElementId: z.string().trim().min(1).max(180).nullable().optional(),
    status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']).optional(),
  })

  router.get('/boards/:boardId/decisions', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    if (!boardId) return res.status(400).json({ error: 'Invalid board ID' })
    if (!await getRole(pool, boardId, sessionUserId(req))) return res.status(404).json({ error: 'Board not found' })
    const result = await pool.query("SELECT d.*, o.display_name AS owner_name, u.display_name AS creator_name FROM board_decisions d LEFT JOIN users o ON o.id = d.owner_id JOIN users u ON u.id = d.created_by WHERE d.board_id = $1 ORDER BY d.updated_at DESC LIMIT 200", [boardId])
    return res.json({ decisions: result.rows })
  })

  router.post('/boards/:boardId/decisions', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = decisionSchema.safeParse(req.body)
    if (!boardId || !parsed.success) return res.status(400).json({ error: 'Invalid decision record' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    if (parsed.data.ownerId) {
      const member = await pool.query('SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, parsed.data.ownerId])
      if (!member.rowCount) return res.status(400).json({ error: 'Decision owner must be a board member' })
    }
    const result = await pool.query("INSERT INTO board_decisions (id, board_id, title, rationale, owner_id, source_element_id, created_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [randomUUID(), boardId, parsed.data.title, parsed.data.rationale, parsed.data.ownerId ?? null, parsed.data.sourceElementId ?? null, userId, parsed.data.status ?? 'proposed'])
    await recordActivity(pool, boardId, userId, 'decision.created', { decisionId: result.rows[0].id, title: parsed.data.title }, 'Decision recorded', parsed.data.title)
    return res.status(201).json({ decision: result.rows[0] })
  })

  router.patch('/boards/:boardId/decisions/:decisionId', async (req, res) => {
    const boardId = parseBoardId(req.params.boardId)
    const parsed = decisionSchema.partial().safeParse(req.body)
    if (!boardId || !parsed.success || Object.keys(parsed.data).length === 0) return res.status(400).json({ error: 'Invalid decision update' })
    const userId = sessionUserId(req)
    const role = await getRole(pool, boardId, userId)
    if (!role) return res.status(404).json({ error: 'Board not found' })
    if (!canEdit(role)) return res.status(403).json({ error: 'Editor access required' })
    if (parsed.data.ownerId) {
      const member = await pool.query('SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, parsed.data.ownerId])
      if (!member.rowCount) return res.status(400).json({ error: 'Decision owner must be a board member' })
    }
    const p = parsed.data
    const result = await pool.query("UPDATE board_decisions SET title = COALESCE($1,title), rationale = COALESCE($2,rationale), status = COALESCE($3,status), owner_id = CASE WHEN $4 THEN $5::uuid ELSE owner_id END, source_element_id = COALESCE($6,source_element_id), updated_at = NOW() WHERE id = $7 AND board_id = $8 RETURNING *", [p.title ?? null, p.rationale ?? null, p.status ?? null, p.ownerId !== undefined, p.ownerId ?? null, p.sourceElementId ?? null, req.params.decisionId, boardId])
    if (!result.rowCount) return res.status(404).json({ error: 'Decision not found' })
    await recordActivity(pool, boardId, userId, 'decision.updated', { decisionId: req.params.decisionId, status: p.status }, 'Decision updated', p.title ?? p.status ?? 'Decision details changed')
    return res.json({ decision: result.rows[0] })
  })

  return router
}
