import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)

    const version = '001_initial'
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version])
    if (applied.rowCount === 0) {
      const migration = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8')
      await client.query(migration)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
      console.log(`Applied migration ${version}`)
    } else {
      console.log('Database schema is up to date')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error: unknown) => {
  console.error('Database migration failed', error)
  process.exitCode = 1
})
