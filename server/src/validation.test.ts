import assert from 'node:assert/strict'
import test from 'node:test'
import { createBoardSchema, loginSchema, registerSchema } from './validation.js'

test('registration trims identity fields and requires a strong password', () => {
  const result = registerSchema.safeParse({
    displayName: '  Tarun  ',
    email: ' tarun@example.com ',
    password: 'a-long-enough-password',
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.displayName, 'Tarun')
    assert.equal(result.data.email, 'tarun@example.com')
  }
  assert.equal(registerSchema.safeParse({ displayName: 'T', email: 't@example.com', password: 'short' }).success, false)
  assert.equal(registerSchema.safeParse({ displayName: 'T', email: 't@example.com', password: '界'.repeat(25) }).success, false)
})

test('login and board inputs reject malformed values', () => {
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'password' }).success, false)
  assert.equal(createBoardSchema.safeParse({ title: '   ' }).success, false)
  assert.equal(createBoardSchema.safeParse({ title: 'CanvasLab' }).success, true)
})
