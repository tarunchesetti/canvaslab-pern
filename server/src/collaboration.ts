import { Database } from '@hocuspocus/extension-database'
import { Server } from '@hocuspocus/server'
import type { Pool } from 'pg'
import { verifyCollaborationToken } from './collaboration-token.js'
import { boardIdSchema } from './validation.js'

type BoardRole = 'owner' | 'editor' | 'viewer'

interface MembershipRow {
  role: BoardRole
  display_name: string
}

interface SnapshotRow {
  snapshot: Buffer
}

function parseBoardId(documentName: string): string {
  const parsed = boardIdSchema.safeParse(documentName)
  if (!parsed.success) throw new Error('Invalid board document name')
  return parsed.data
}

export function createCollaborationServer(pool: Pool, sessionSecret: string, port: number): Server {
  return new Server({
    port,
    // Keep the persistence window short so quick navigation/refreshes are
    // less likely to leave recent strokes waiting in the in-memory document.
    debounce: 500,
    maxDebounce: 2000,
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          const boardId = parseBoardId(documentName)
          // Older boards may predate board_documents initialization. Ensure a
          // durable document row exists before asking Hocuspocus to load it.
          await pool.query(
            `INSERT INTO board_documents (board_id)
             SELECT id FROM boards WHERE id = $1
             ON CONFLICT (board_id) DO NOTHING`,
            [boardId],
          )
          const result = await pool.query<SnapshotRow>(
            `SELECT d.snapshot
             FROM board_documents d
             JOIN boards b ON b.id = d.board_id
             WHERE d.board_id = $1`,
            [boardId],
          )
          const snapshot = result.rows[0]?.snapshot
          if (!snapshot) throw new Error('Board document not found')
          return new Uint8Array(snapshot)
        },
        store: async ({ documentName, state }) => {
          const boardId = parseBoardId(documentName)
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            const saved = await client.query(
              `INSERT INTO board_documents (board_id, snapshot, version, updated_at)
               SELECT id, $1, 1, NOW() FROM boards WHERE id = $2
               ON CONFLICT (board_id) DO UPDATE
               SET snapshot = EXCLUDED.snapshot,
                   version = board_documents.version + 1,
                   updated_at = NOW()
               RETURNING board_id`,
              [Buffer.from(state), boardId],
            )
            if (saved.rowCount !== 1) throw new Error('Board document not found')
            await client.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [boardId])
            await client.query('COMMIT')
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          } finally {
            client.release()
          }
        },
      }),
    ],
    async onAuthenticate({ documentName, token, connectionConfig }) {
      const boardId = parseBoardId(documentName)
      const userId = await verifyCollaborationToken(token, sessionSecret)
      if (!userId) throw new Error('Authentication required')

      const membership = await pool.query<MembershipRow>(
        `SELECT m.role, u.display_name
         FROM board_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.board_id = $1 AND m.user_id = $2`,
        [boardId, userId],
      )
      const member = membership.rows[0]
      if (!member) throw new Error('Board access denied')

      connectionConfig.readOnly = member.role === 'viewer'
      return { userId, role: member.role, displayName: member.display_name }
    },
    async onTokenSync({ documentName, token, context, connectionConfig }) {
      const boardId = parseBoardId(documentName)
      const userId = await verifyCollaborationToken(token, sessionSecret)
      if (!userId || !context || context.userId !== userId) {
        throw new Error('Authentication required')
      }

      // Re-check membership during active sessions so role changes and removals
      // are enforced without waiting for a full browser reconnect.
      const membership = await pool.query<MembershipRow>(
        `SELECT m.role, u.display_name
         FROM board_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.board_id = $1 AND m.user_id = $2`,
        [boardId, userId],
      )
      const member = membership.rows[0]
      if (!member) throw new Error('Board access denied')

      connectionConfig.readOnly = member.role === 'viewer'
      return { userId, role: member.role, displayName: member.display_name }
    },
    async beforeHandleAwareness({ states, context }) {
      if (!context) return
      for (const state of states.values()) {
        state.user = {
          id: context?.userId,
          name: context?.displayName,
          color: '#c78569',
        }
      }
    },
  })
}
