import assert from 'node:assert/strict'
import test from 'node:test'
import { createCollaborationToken, verifyCollaborationToken } from './collaboration-token.js'

test('collaboration tokens identify their user and reject invalid signatures', async () => {
  const secret = 'local-test-secret-with-at-least-32-characters'
  const token = await createCollaborationToken('user-123', secret)

  assert.equal(await verifyCollaborationToken(token, secret), 'user-123')
  assert.equal(await verifyCollaborationToken(token, `${secret}-wrong`), null)
  assert.equal(await verifyCollaborationToken('not-a-token', secret), null)
})