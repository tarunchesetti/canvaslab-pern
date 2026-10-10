import assert from 'node:assert/strict'
import test from 'node:test'
import { canEditBoard } from './routes/boards.js'

test('owners and editors can edit while viewers remain read-only', () => {
  assert.equal(canEditBoard('owner'), true)
  assert.equal(canEditBoard('editor'), true)
  assert.equal(canEditBoard('viewer'), false)
})
