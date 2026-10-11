import { z } from 'zod'

export const registerSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
})

export const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

export const updateBoardSchema = createBoardSchema

export const boardIdSchema = z.string().uuid()

export const boardMemberSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['editor', 'viewer']),
})

export const boardMemberRoleSchema = z.object({
  role: z.enum(['editor', 'viewer']),
})

export const userIdSchema = z.string().uuid()


export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
})

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
})
