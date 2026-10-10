import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, sessionUserId } from '../auth.js'
import { boardIdSchema, createBoardSchema, updateBoardSchema } from '../validation.js'

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

export function canEditBoard(role: BoardRole): boolean {
  return role === 'owner' || role === 'editor'
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

export function createBoardsRouter(pool: Pool): Router {
  const router = Router()
  router.use(requireAuth)

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

  return router
}
