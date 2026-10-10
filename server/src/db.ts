import { Pool } from 'pg'
import { environment } from './config.js'

export const pool = new Pool({
  connectionString: environment.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})
