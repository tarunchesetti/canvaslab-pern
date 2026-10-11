import assert from 'node:assert/strict'
import test from 'node:test'
import { passwordResetCompleteSchema, passwordResetRequestSchema } from './validation.js'

test('password reset requests require a valid email', () => {
  assert.equal(passwordResetRequestSchema.safeParse({ email: 'person@example.com' }).success, true)
  assert.equal(passwordResetRequestSchema.safeParse({ email: 'not-an-email' }).success, false)
})

test('password reset completion requires a token and a valid password', () => {
  assert.equal(passwordResetCompleteSchema.safeParse({ token: 'a'.repeat(43), password: 'a-strong-password' }).success, true)
  assert.equal(passwordResetCompleteSchema.safeParse({ token: 'short', password: 'a-strong-password' }).success, false)
  assert.equal(passwordResetCompleteSchema.safeParse({ token: 'a'.repeat(43), password: 'short' }).success, false)
  assert.equal(passwordResetCompleteSchema.safeParse({ token: 'a'.repeat(43), password: 'a'.repeat(73) }).success, false)
})
