import { readdir, readFile } from 'node:fs/promises'
import { pool } from './db.js'

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)

    const migrationDirectory = new URL('../migrations/', import.meta.url)
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort()

    for (const migrationFile of migrationFiles) {
      const version = migrationFile.replace(/\.sql$/i, '')
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version])
      if (applied.rowCount !== 0) continue

      const migration = await readFile(new URL(migrationFile, migrationDirectory), 'utf8')
      await client.query(migration)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
      console.log(`Applied migration ${version}`)
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
