import 'dotenv/config'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  COLLAB_PORT: z.coerce.number().int().min(1).max(65535).default(1234),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  PASSWORD_RESET_EMAIL_WEBHOOK_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  PASSWORD_RESET_EMAIL_WEBHOOK_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
})

export const environment = environmentSchema.parse(process.env)

export type Environment = z.infer<typeof environmentSchema>
