import assert from 'node:assert/strict'
import test from 'node:test'
import { passwordsMatch } from './auth-validation.js'

test('matching non-empty passwords are accepted', () => {
  assert.equal(passwordsMatch('a-strong-password', 'a-strong-password'), true)
})

test('different passwords are rejected', () => {
  assert.equal(passwordsMatch('a-strong-password', 'a-different-password'), false)
})

test('empty passwords are not accepted as a match', () => {
  assert.equal(passwordsMatch('', ''), false)
})
